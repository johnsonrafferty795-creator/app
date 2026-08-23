/* How each movement is performed, drawn rather than described.
 *
 * The plan assumes you already know what a 90/90 hip switch looks like. Anyone
 * who does not cannot use it, and a written cue does not fix that — so every
 * exercise carries a figure showing the position.
 *
 * They are drawn here as inline SVG rather than fetched as pictures: the app
 * has to work on a phone with no signal, and a folder of illustrations is both
 * a download and something to keep. A figure is a handful of coordinates, so
 * all fifteen together cost less than one photograph.
 *
 * Only src/golf-app.jsx imports this file, so nothing here can reach the other
 * apps on the domain.
 */

/* Everything is drawn in a 240 × 150 box with the floor at y = 132. */
const GROUND_Y = 132;

const CHALK = "#F2F0E8";

/* A pose is joints, in drawing order: the spine as a curve, then limbs as
 * polylines with a bend at the elbow or knee. Limbs on the far side of the
 * body are listed separately and drawn faint, which is the whole of the depth
 * in these — no shading, no outlines. */

/* Quadruped positions (cat–cow, bird dog) share a footprint; `ox` slides one
   along so two frames of the same movement can sit side by side. */
const quad = (ox) => ({
  hand: [ox + 20, 126],
  foot: [ox + 96, 126],
  shoulder: [ox + 30, 90],
  hip: [ox + 82, 92],
});

const FIGURES = {
  /* ---------------------------------------------------------------- A ---- */

  a1: {
    alt: "Kneeling on one knee with the back foot up against a wall behind, torso tall.",
    props: [
      { k: "ground" },
      { k: "wall", x: 202 },
    ],
    poses: [
      {
        head: [122, 46],
        spine: [[123, 60], [125, 78], [128, 96]],
        far: [
          [[128, 96], [86, 106], [82, 131]],
          [[125, 66], [114, 86], [104, 100]],
        ],
        limbs: [
          /* back leg: thigh down to a knee on the floor, shin up the wall */
          [[128, 96], [150, 128], [194, 90]],
          /* front leg planted, bent to a right angle */
          [[128, 96], [88, 104], [84, 131]],
          [[126, 66], [112, 88], [100, 102]],
        ],
      },
    ],
  },

  a2: {
    alt: "Seen from above: sitting with one shin across the front and the other out behind, both knees at right angles.",
    note: "from above",
    props: [],
    poses: [
      {
        head: [120, 44],
        spine: [[120, 60], [120, 80], [120, 100]],
        far: [
          [[104, 68], [88, 78], [76, 74]],
          [[136, 68], [152, 78], [164, 74]],
        ],
        limbs: [
          /* the shoulders, which is what tells you this is a back seen
             from above rather than a body lying on the floor */
          [[104, 68], [120, 66], [136, 68]],
          /* front leg: thigh out to the side, shin running forward */
          [[114, 100], [70, 90], [62, 46]],
          /* back leg: thigh out the other way, shin running back */
          [[126, 100], [170, 110], [178, 140]],
        ],
      },
    ],
  },

  a3: {
    alt: "A deep lunge with one hand on the floor inside the front foot and the other arm reaching to the ceiling.",
    props: [
      { k: "ground" },
      { k: "arc", d: "M104,120 C118,96 140,66 152,42", head: [154, 38, -62] },
    ],
    poses: [
      {
        head: [124, 58],
        spine: [[126, 72], [130, 88], [134, 104]],
        far: [
          [[134, 104], [180, 120], [214, 131]],
          [[128, 78], [116, 100], [104, 126]],
        ],
        limbs: [
          /* front leg bent over the planted foot */
          [[134, 104], [92, 98], [86, 132]],
          /* the reaching arm, following the eyes up */
          [[128, 76], [146, 58], [156, 34]],
        ],
      },
    ],
  },

  a4: {
    alt: "On hands and knees: the back rounded up in one frame, dropped and arched in the next.",
    props: [
      { k: "ground" },
      { k: "arc", d: "M112,58 C120,52 124,60 118,74", head: [117, 78, 110] },
    ],
    poses: [
      /* cat: the spine pushed to the ceiling, head tucked under */
      (() => {
        const q = quad(2);
        return {
          head: [q.hand[0] + 2, 102],
          spine: [q.shoulder, [q.shoulder[0] + 26, 62], q.hip],
          far: [],
          limbs: [
            [q.shoulder, [q.hand[0] + 6, 107], q.hand],
            [q.hip, [q.hip[0] + 6, 110], q.foot],
          ],
        };
      })(),
      /* cow: the same position with the belly dropped and the eyes up */
      (() => {
        const q = quad(126);
        return {
          head: [q.hand[0] - 2, 78],
          spine: [[q.shoulder[0], 94], [q.shoulder[0] + 26, 116], [q.hip[0], 96]],
          far: [],
          limbs: [
            [[q.shoulder[0], 94], [q.hand[0] + 6, 110], q.hand],
            [[q.hip[0], 96], [q.hip[0] + 6, 112], q.foot],
          ],
        };
      })(),
    ],
  },

  a5: {
    alt: "Lying on one side with the knees bent up, the top arm sweeping open towards the ceiling.",
    props: [
      { k: "ground" },
      { k: "arc", d: "M36,124 C40,96 50,74 62,56", head: [64, 52, -55] },
    ],
    poses: [
      {
        head: [62, 116],
        spine: [[78, 119], [110, 121], [142, 122]],
        far: [
          [[82, 119], [58, 124], [34, 128]],
          [[142, 122], [108, 112], [138, 128]],
        ],
        limbs: [
          /* knees stacked and drawn up towards the chest */
          [[142, 122], [104, 110], [136, 128]],
          [[82, 114], [72, 88], [66, 58]],
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- B ---- */

  b1: {
    alt: "On your back: one arm and the opposite leg reaching away, the other arm and knee held up at right angles.",
    props: [{ k: "ground" }],
    poses: [
      {
        head: [72, 116],
        spine: [[88, 119], [126, 121], [164, 122]],
        far: [],
        limbs: [
          /* the held side: shin level over the knee, the other arm upright */
          [[164, 122], [162, 92], [192, 88]],
          [[90, 117], [92, 96], [96, 78]],
          /* the working side, both reaching away and hovering off the floor */
          [[164, 122], [194, 118], [218, 116]],
          [[92, 118], [70, 108], [46, 100]],
        ],
      },
    ],
  },

  b2: {
    alt: "On hands and knees with one arm and the opposite leg stretched out level with the back.",
    props: [
      { k: "ground" },
      { k: "arrow", d: "M34,60 L14,54", head: [12, 53, 197] },
      { k: "arrow", d: "M206,76 L226,72", head: [228, 71, -11] },
    ],
    poses: [
      {
        head: [66, 84],
        spine: [[78, 88], [114, 87], [150, 88]],
        far: [
          [[78, 90], [74, 108], [70, 126]],
          [[150, 90], [153, 108], [164, 126]],
        ],
        limbs: [
          /* long from fingertip to heel, and level with the back */
          [[78, 88], [54, 78], [32, 62]],
          [[150, 88], [180, 82], [208, 76]],
        ],
      },
    ],
  },

  b3: {
    alt: "Standing square, side-on to an anchored band, both hands held together out from the chest.",
    props: [
      { k: "wall", x: 214 },
      { k: "band", a: [214, 88], b: [126, 88] },
      { k: "ground" },
      { k: "arrow", d: "M142,106 L184,106", head: [188, 106, 0] },
    ],
    poses: [
      {
        head: [120, 42],
        spine: [[120, 56], [120, 78], [120, 100]],
        far: [],
        limbs: [
          /* feet apart and level — standing square is the whole exercise */
          [[120, 100], [105, 116], [103, 131]],
          [[120, 100], [135, 116], [137, 131]],
          /* both hands together, out in front of the sternum */
          [[106, 64], [104, 80], [121, 88]],
          [[134, 64], [136, 80], [123, 88]],
        ],
      },
    ],
  },

  b4: {
    alt: "A press-up position with one hand lifted to tap the opposite shoulder.",
    props: [
      { k: "ground" },
      { k: "arc", d: "M96,110 C90,98 90,90 96,84", head: [98, 82, -50] },
    ],
    poses: [
      {
        head: [72, 78],
        spine: [[88, 86], [132, 100], [176, 113]],
        far: [
          [[176, 113], [196, 122], [214, 130]],
          [[88, 88], [86, 108], [84, 128]],
        ],
        limbs: [
          /* feet wide, hips level, one hand up at the far shoulder */
          [[176, 113], [198, 126], [214, 131]],
          [[88, 86], [106, 98], [96, 82]],
        ],
      },
    ],
  },

  b5: {
    alt: "A side plank on one forearm, the top arm threaded under the ribs before opening back up.",
    props: [
      { k: "ground" },
      { k: "arc", d: "M126,116 C118,96 110,76 102,58", head: [101, 54, -113] },
    ],
    poses: [
      {
        head: [74, 92],
        spine: [[88, 98], [132, 111], [174, 122]],
        far: [
          [[174, 122], [192, 127], [208, 131]],
        ],
        limbs: [
          /* the forearm on the floor, holding the hips high */
          [[88, 98], [74, 116], [72, 130]],
          [[174, 122], [194, 126], [210, 130]],
          /* the top arm, mid-thread */
          [[88, 96], [106, 105], [126, 116]],
        ],
      },
    ],
  },

  b6: {
    alt: "Sitting leaning back with the knees bent, carrying the hands across from one side to the other.",
    props: [
      { k: "ground" },
      { k: "arc", d: "M92,62 C118,44 156,48 174,70", head: [176, 74, 55] },
    ],
    poses: [
      {
        head: [92, 74],
        spine: [[104, 86], [126, 105], [150, 124]],
        far: [
          [[150, 124], [104, 110], [92, 131]],
          [[110, 92], [128, 102], [148, 96]],
        ],
        limbs: [
          [[150, 124], [98, 104], [86, 131]],
          /* hands together, carried across rather than swung */
          [[108, 90], [126, 100], [146, 94]],
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- C ---- */

  c1: {
    alt: "In a golf address position with a club across the shoulders, turning the chest over a still lower half.",
    props: [
      { k: "ground" },
      { k: "club", a: [58, 88], b: [136, 60] },
      { k: "arc", d: "M74,50 C104,34 140,38 158,54", head: [161, 58, 52] },
    ],
    poses: [
      {
        head: [86, 62],
        spine: [[96, 74], [112, 86], [128, 98]],
        far: [
          [[128, 98], [136, 116], [134, 132]],
          [[98, 74], [118, 68], [134, 62]],
        ],
        limbs: [
          /* hinged at the hips, knees soft, lower half quiet */
          [[128, 98], [110, 116], [102, 132]],
          [[98, 76], [78, 82], [60, 88]],
        ],
      },
    ],
  },

  c2: {
    alt: "Sitting on a bench holding a band out to one side, turning the mid-back away from the anchor.",
    props: [
      { k: "bench", x0: 118, x1: 198, y: 112 },
      { k: "wall", x: 26 },
      { k: "band", a: [26, 86], b: [102, 86] },
      { k: "ground" },
      { k: "arc", d: "M156,48 C130,36 100,44 86,62", head: [84, 66, 128] },
    ],
    poses: [
      {
        head: [147, 50],
        spine: [[148, 64], [149, 86], [150, 108]],
        far: [
          [[150, 108], [116, 114], [112, 131]],
          [[151, 70], [130, 82], [106, 88]],
        ],
        limbs: [
          /* hips on the seat, thighs level, shins down — plainly sitting */
          [[150, 108], [112, 110], [108, 131]],
          [[146, 70], [126, 80], [104, 86]],
        ],
      },
    ],
  },

  c3: {
    alt: "Sitting in the 90/90 position and lifting the back knee well clear of the floor, body still.",
    props: [
      { k: "ground" },
      { k: "arrow", d: "M156,102 L156,70", head: [156, 66, -90] },
    ],
    poses: [
      {
        head: [107, 50],
        spine: [[108, 64], [110, 88], [112, 112]],
        far: [
          [[112, 112], [64, 118], [110, 130]],
          [[110, 70], [132, 94], [144, 126]],
        ],
        limbs: [
          /* front shin down on the floor */
          [[112, 112], [62, 117], [112, 131]],
          /* back leg bent, knee carried high above the hip */
          [[112, 112], [152, 86], [192, 114]],
          [[110, 70], [130, 96], [142, 128]],
        ],
      },
    ],
  },

  c4: {
    alt: "Standing side-on to a wall, turning off the back foot to throw a ball hard into it.",
    props: [
      { k: "wall", x: 216 },
      { k: "ground" },
      { k: "ball", at: [70, 90], r: 10 },
      { k: "arc", d: "M84,74 C124,50 172,56 198,76", head: [201, 79, 47] },
    ],
    poses: [
      {
        head: [112, 44],
        spine: [[112, 58], [111, 78], [110, 98]],
        far: [
          [[110, 98], [126, 116], [128, 132]],
          [[122, 62], [104, 76], [80, 86]],
        ],
        limbs: [
          [[110, 98], [96, 116], [92, 132]],
          /* the ball starts low and behind, and is let go fast */
          [[104, 62], [90, 76], [78, 86]],
        ],
      },
    ],
  },

  c5: {
    alt: "Lying on your back with the knees bent, driving the hips up into a straight line.",
    props: [
      { k: "ground" },
      { k: "arrow", d: "M146,78 L146,56", head: [146, 52, -90] },
    ],
    poses: [
      {
        head: [46, 122],
        spine: [[66, 127], [106, 110], [146, 94]],
        far: [
          [[146, 94], [172, 112], [178, 131]],
          [[72, 127], [92, 131], [112, 132]],
        ],
        limbs: [
          /* shins upright, heels under the knees */
          [[146, 94], [166, 112], [170, 131]],
          [[72, 128], [94, 131], [116, 132]],
        ],
      },
    ],
  },
};

/* ============================ drawing ============================ */

/* A spine bends; an arm does not. Three points become a curve through the
   middle one, which is what lets the same helper draw a rounded back and a
   flat one. */
function curve(points) {
  if (points.length < 3) return `M${points.map((p) => p.join(",")).join(" L")}`;
  const [a, c, b] = points;
  return `M${a[0]},${a[1]} Q${c[0]},${c[1]} ${b[0]},${b[1]}`;
}

const bone = (width, faint) => ({
  fill: "none",
  stroke: CHALK,
  strokeWidth: width,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  opacity: faint ? 0.5 : 0.94,
});

/* The floor, a wall, a bench, a band, a ball — whatever the position needs to
   make sense, drawn faint so the body stays the subject. */
function Prop({ p, colour }) {
  const dim = { fill: "none", stroke: CHALK, strokeWidth: 2.5, strokeLinecap: "round", opacity: 0.3 };
  switch (p.k) {
    case "ground":
      return <line x1="8" y1={GROUND_Y} x2="232" y2={GROUND_Y} style={dim} />;
    case "wall":
      return <line x1={p.x} y1="26" x2={p.x} y2={GROUND_Y} style={dim} />;
    case "bench":
      return (
        <g style={dim}>
          <line x1={p.x0} y1={p.y} x2={p.x1} y2={p.y} />
          <line x1={p.x0 + 6} y1={p.y} x2={p.x0 + 6} y2={GROUND_Y} />
          <line x1={p.x1 - 6} y1={p.y} x2={p.x1 - 6} y2={GROUND_Y} />
        </g>
      );
    case "club":
      return (
        <line
          x1={p.a[0]} y1={p.a[1]} x2={p.b[0]} y2={p.b[1]}
          style={{ ...dim, strokeWidth: 4, opacity: 0.55 }}
        />
      );
    case "band":
      return (
        <line
          x1={p.a[0]} y1={p.a[1]} x2={p.b[0]} y2={p.b[1]}
          style={{ ...dim, strokeWidth: 3, opacity: 0.5, strokeDasharray: "7 5" }}
        />
      );
    case "ball":
      return (
        <circle
          cx={p.at[0]} cy={p.at[1]} r={p.r}
          style={{ fill: CHALK, fillOpacity: 0.14, stroke: CHALK, strokeWidth: 2.5, opacity: 0.55 }}
        />
      );
    /* the one thing drawn in the block's own colour: where the movement goes */
    case "arc":
    case "arrow":
      return (
        <g>
          <path
            d={p.d}
            style={{ fill: "none", stroke: colour, strokeWidth: 3, strokeLinecap: "round" }}
          />
          <path
            d="M0,0 L-9,-5 L-9,5 Z"
            transform={`translate(${p.head[0]},${p.head[1]}) rotate(${p.head[2]})`}
            style={{ fill: colour }}
          />
        </g>
      );
    default:
      return null;
  }
}

function Pose({ pose }) {
  return (
    <g>
      {(pose.far || []).map((limb, i) => (
        <polyline key={`f${i}`} points={limb.map((pt) => pt.join(",")).join(" ")} style={bone(6, true)} />
      ))}
      <path d={curve(pose.spine)} style={bone(8)} />
      {(pose.limbs || []).map((limb, i) => (
        <polyline key={`n${i}`} points={limb.map((pt) => pt.join(",")).join(" ")} style={bone(6.5)} />
      ))}
      <circle cx={pose.head[0]} cy={pose.head[1]} r="10.5" style={{ fill: CHALK, opacity: 0.94 }} />
    </g>
  );
}

/* The figure for one exercise. Nothing is drawn if there is no figure for it,
   rather than leaving an empty frame on the screen. */
export function Diagram({ id, colour, height = 132 }) {
  const figure = FIGURES[id];
  if (!figure) return null;
  return (
    <svg
      viewBox="0 0 240 150"
      width="100%"
      height={height}
      role="img"
      aria-label={figure.alt}
      style={{
        display: "block",
        background: "rgba(242,240,232,0.05)",
        borderRadius: 14,
      }}
    >
      {figure.props.map((p, i) => (
        <Prop key={i} p={p} colour={colour} />
      ))}
      {figure.poses.map((pose, i) => (
        <Pose key={i} pose={pose} />
      ))}
      {figure.note ? (
        <text
          x="10" y="18"
          style={{
            fill: CHALK,
            opacity: 0.45,
            font: "600 12px 'Helvetica Neue',Arial,sans-serif",
            letterSpacing: 0.4,
          }}
        >
          {figure.note}
        </text>
      ) : null}
    </svg>
  );
}

export default FIGURES;
export { GROUND_Y, CHALK };
