import { useState } from "react";

import {
  buildBackup,
  checkBackup,
  readBackupFile,
  restoreBackup,
  saveBackup,
  summarise,
} from "./backup";
import { today } from "./dates";
import { Btn, SectionLabel } from "./ui";
import { CARD, DISPLAY, MUTE, ON_ACCENT, RULE, TEXT } from "./tokens";

/* Export and restore, shared by both trackers. Everything lives in one
   phone's localStorage, so a lost handset is a lost year of training unless
   there is a copy of it somewhere else. */
export function BackupCard({ app, prefix, keys, accent }) {
  const [stage, setStage] = useState("idle");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(null);

  const filename = `${prefix}-backup-${today()}.json`;

  const doExport = async () => {
    const how = await saveBackup(buildBackup(app, keys), filename);
    setNote(
      how === "shared"
        ? "Saved. Put it somewhere that is not this phone."
        : how === "downloaded"
        ? `Saved as ${filename}.`
        : how === "cancelled"
        ? ""
        : "This phone would not let the app save a file."
    );
  };

  const pickFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const payload = await readBackupFile(file);
      const problem = checkBackup(payload, app, keys);
      if (problem) {
        setNote(problem);
        setStage("idle");
        return;
      }
      setPending(payload);
      setNote("");
      setStage("confirm");
    } catch (err) {
      setNote(err.message);
      setStage("idle");
    }
  };

  const confirmRestore = () => {
    restoreBackup(pending, keys);
    /* simplest way to be sure every screen reads the restored data */
    window.location.reload();
  };

  const sum = pending ? summarise(pending, prefix) : null;

  return (
    <div style={{ borderTop: `1px solid ${RULE}`, marginTop: 20, paddingTop: 14 }}>
      <SectionLabel style={{ marginBottom: 8 }}>Backup</SectionLabel>
      <div style={{ fontSize: 15, color: MUTE, lineHeight: 1.4, marginBottom: 10 }}>
        Everything is stored on this phone and nowhere else. Save a copy now and
        again — email it to yourself, drop it in Files, anywhere but here.
      </div>

      {stage !== "confirm" && (
        <>
          <Btn
            onClick={doExport}
            style={{
              width: "100%",
              padding: "16px 0",
              fontSize: 18,
              background: accent,
              color: ON_ACCENT,
            }}
          >
            Export a backup
          </Btn>

          <label
            style={{
              display: "block",
              width: "100%",
              marginTop: 8,
              padding: "16px 0",
              fontSize: 18,
              fontFamily: DISPLAY,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              textAlign: "center",
              background: CARD,
              color: TEXT,
              border: `1px solid ${RULE}`,
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            Restore from a file
            <input
              type="file"
              accept="application/json,.json"
              onChange={pickFile}
              style={{ display: "none" }}
            />
          </label>
        </>
      )}

      {stage === "confirm" && sum && (
        <div className="orn" style={{ border: `1px solid ${accent}`, borderRadius: 14, padding: "12px 12px 14px" }}>
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 20,
              textTransform: "uppercase",
              letterSpacing: "-0.03em",
            }}
          >
            Replace everything on this phone?
          </div>
          <div style={{ fontSize: 15, marginTop: 6, lineHeight: 1.4 }}>
            That file holds <strong>{sum.sessions}</strong> session
            {sum.sessions === 1 ? "" : "s"}, <strong>{sum.exercises}</strong> exercise
            {sum.exercises === 1 ? "" : "s"}
            {sum.weighIns ? (
              <>
                {" "}
                and <strong>{sum.weighIns}</strong> weigh-in
                {sum.weighIns === 1 ? "" : "s"}
              </>
            ) : null}
            {sum.exportedAt ? `, saved ${sum.exportedAt}` : ""}. What is on this phone
            now will be written over and cannot be got back.
          </div>
          <Btn
            onClick={confirmRestore}
            style={{
              width: "100%",
              marginTop: 12,
              padding: "16px 0",
              fontSize: 18,
              background: accent,
              color: ON_ACCENT,
            }}
          >
            Replace everything
          </Btn>
          <Btn
            onClick={() => {
              setStage("idle");
              setPending(null);
            }}
            style={{
              width: "100%",
              marginTop: 8,
              padding: "14px 0",
              fontSize: 16,
              background: CARD,
              color: TEXT,
              border: `1px solid ${RULE}`,
            }}
          >
            Cancel
          </Btn>
        </div>
      )}

      {note && (
        <div style={{ fontSize: 14, fontWeight: 700, color: MUTE, marginTop: 8 }}>
          {note}
        </div>
      )}
    </div>
  );
}
