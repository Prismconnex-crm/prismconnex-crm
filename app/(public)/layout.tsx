import { PublicFooter } from "@/components/layout/public-footer";
import { PublicNavbar } from "@/components/layout/public-navbar";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-gradient min-h-screen bg-background">
      <PublicNavbar />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
