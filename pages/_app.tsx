import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { CurrentUserProvider } from "@/lib/currentUser";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <CurrentUserProvider>
      <Component {...pageProps} />
    </CurrentUserProvider>
  );
}
