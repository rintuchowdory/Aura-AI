import { motion } from "framer-motion";

const blobs = [
  { color: "var(--aurora-1)", size: 520, top: "-10%", left: "-8%", dur: 22 },
  { color: "var(--aurora-2)", size: 460, top: "10%", left: "60%", dur: 26 },
  { color: "var(--aurora-3)", size: 400, top: "55%", left: "5%", dur: 30 },
  { color: "var(--aurora-4)", size: 480, top: "60%", left: "58%", dur: 24 },
];

export default function AuroraBackground() {
  return (
    <div className="aurora-root" aria-hidden="true">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className="aurora-blob"
          style={{
            width: b.size,
            height: b.size,
            top: b.top,
            left: b.left,
            background: b.color,
          }}
          animate={{
            x: [0, 40, -30, 0],
            y: [0, -30, 20, 0],
            scale: [1, 1.15, 0.95, 1],
          }}
          transition={{
            duration: b.dur,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
      <div className="aurora-grain" />
    </div>
  );
}
