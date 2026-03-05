import { useRouter } from 'next/router';
import { AnimatePresence, motion } from 'framer-motion';
import '../styles/globals.css';
import Layout from '../components/Layout';
import { ChatProvider } from '../contexts/ChatContext';

export default function App({ Component, pageProps }) {
  const router = useRouter();

  return (
    <ChatProvider>
      <Layout>
        <AnimatePresence mode="wait">
          <motion.div
            key={router.pathname}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <Component {...pageProps} />
          </motion.div>
        </AnimatePresence>
      </Layout>
    </ChatProvider>
  );
}
