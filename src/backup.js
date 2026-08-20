/* Backup and restore.
 *
 * Both apps keep everything in localStorage on the one phone, so a file you
 * can put somewhere else is the only thing standing between a lost handset and
 * a lost year of training. Export writes every key the app owns; restore puts
 * them back.
 */

const VERSION = 1;

export function buildBackup(app, keys) {
  const data = {};
  keys.forEach((k) => {
    const raw = localStorage.getItem(k);
    if (raw === null) return;
    try {
      data[k] = JSON.parse(raw);
    } catch (e) {
      /* a corrupted value is left out rather than poisoning the file */
    }
  });
  return { app, version: VERSION, exportedAt: new Date().toISOString(), data };
}

/* What a backup holds, in the terms the app talks in. */
export function summarise(payload, prefix) {
  const d = (payload && payload.data) || {};
  const days = d[`${prefix}-days`] || {};
  const lifts = d[`${prefix}-lifts`] || {};
  const weight = d[`${prefix}-weight`] || {};
  return {
    sessions: Object.keys(days).filter((k) => days[k] && days[k].workout).length,
    exercises: Object.keys(lifts).length,
    weighIns: Object.keys(weight).length,
    exportedAt: payload && payload.exportedAt ? payload.exportedAt.slice(0, 10) : null,
  };
}

/* iOS standalone apps cannot reliably start a download, but they can open the
   share sheet — which is where "Save to Files" lives. Try that first, fall back
   to a download, and let the caller show the raw text if neither works. */
export async function saveBackup(payload, filename) {
  const json = JSON.stringify(payload, null, 2);

  try {
    const file = new File([json], filename, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    }
  } catch (e) {
    /* cancelled, or sharing files is not allowed here — fall through */
    if (e && e.name === "AbortError") return "cancelled";
  }

  try {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return "downloaded";
  } catch (e) {
    return "failed";
  }
}

export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (e) {
        reject(new Error("That is not a backup file."));
      }
    };
    reader.readAsText(file);
  });
}

/* Both apps share an origin, so the wrong file would otherwise overwrite the
   wrong app's history. */
export function checkBackup(payload, app, keys) {
  if (!payload || typeof payload !== "object" || !payload.data) {
    return "That is not a backup file.";
  }
  if (payload.app && payload.app !== app) {
    return "That backup belongs to the other app.";
  }
  const known = Object.keys(payload.data).filter((k) => keys.includes(k));
  if (!known.length) return "That backup has nothing this app can read.";
  return null;
}

export function restoreBackup(payload, keys) {
  keys.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(payload.data, k)) {
      localStorage.setItem(k, JSON.stringify(payload.data[k]));
    }
  });
}
