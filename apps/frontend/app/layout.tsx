import './globals.css';
import  LogoutButton from '../components/LogoutButton';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="bg-gray-50 min-h-screen">
        <nav className="p-4 flex justify-between bg-white shadow">
          <span className="font-bold text-lg">HubSpot App 中台</span>
          <LogoutButton />
        </nav>
        <main className="p-8">{children}</main>
      </body>
    </html>
  );
}
