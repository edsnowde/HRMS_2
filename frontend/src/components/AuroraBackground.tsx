import { motion } from "framer-motion";

export const AuroraBackground = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute inset-0 opacity-30"
        animate={{
          backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 50% -20%, hsl(var(--teal)) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 0% 50%, hsl(var(--violet)) 0%, transparent 50%),
            radial-gradient(ellipse 60% 50% at 100% 50%, hsl(var(--pink)) 0%, transparent 50%)
          `,
          backgroundSize: "200% 200%",
        }}
      />
      
      <motion.div
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.3, 0.2],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          background: "radial-gradient(circle, hsl(var(--teal)) 0%, transparent 70%)",
        }}
      />

      <motion.div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.25, 0.2],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
        style={{
          background: "radial-gradient(circle, hsl(var(--violet)) 0%, transparent 70%)",
        }}
      />
    </div>
  );
};
