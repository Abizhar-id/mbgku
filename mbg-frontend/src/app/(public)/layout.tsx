import Navbar from '@/components/shared/Navbar';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-page)' }}>
      <Navbar />
      {children}
    </div>
  );
}
