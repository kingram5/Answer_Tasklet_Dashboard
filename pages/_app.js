import '../styles/globals.css';
import Layout from '../components/Layout';
import { ChatProvider } from '../contexts/ChatContext';

export default function App({ Component, pageProps }) {
  return (
    <ChatProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </ChatProvider>
  );
}
