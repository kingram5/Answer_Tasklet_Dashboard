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
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Component {...pageProps} />
          </motion.div>
        </AnimatePresence>
      </Layout>
    </ChatProvider>
  );
}
