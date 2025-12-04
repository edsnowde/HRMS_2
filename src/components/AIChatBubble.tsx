import { MessageCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { GlassCard } from "./GlassCard";
import { GlassButton } from "./GlassButton";

export const AIChatBubble = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <motion.div
        className="fixed bottom-8 right-8 z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="glass w-16 h-16 rounded-full flex items-center justify-center glow-teal hover:glow-violet transition-all duration-300"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          animate={{ 
            boxShadow: [
              "0 0 20px rgba(8, 145, 178, 0.5)",
              "0 0 40px rgba(139, 92, 246, 0.5)",
              "0 0 20px rgba(8, 145, 178, 0.5)",
            ]
          }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <MessageCircle className="w-8 h-8 text-primary" />
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-28 right-8 z-50 w-96"
          >
            <GlassCard className="p-0 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <h3 className="text-lg font-semibold text-glow-teal">Auralis AI Assistant</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="hover:bg-foreground/10 p-2 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 h-96 overflow-y-auto space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 text-primary" />
                  </div>
                  <div className="glass rounded-2xl p-3 max-w-[80%]">
                    <p className="text-sm">Hello! I'm your AI assistant. How can I help you today?</p>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border/50">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type your message..."
                    className="flex-1 glass px-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <GlassButton variant="primary" className="px-4 py-2">
                    Send
                  </GlassButton>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
