import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PheonixOfIDX",
  description: "Stock Analysis Dashboard — Phoenix Bot IDX",
};

import Navbar from "./components/Navbar";
import PasswordGate from "./components/PasswordGate";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme');
                  if (theme === 'light') {
                    document.body.classList.add('light-theme');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`antialiased`}
      >
        <PasswordGate>
          <Navbar />
          {children}
        </PasswordGate>
      </body>
    </html>
  );
}
