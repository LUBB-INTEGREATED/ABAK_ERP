import Image from 'next/image';
import Link from 'next/link';
import { formatEntityId } from 'shared-utils';

export default function Home() {
  const sampleId = formatEntityId('LEAD', new Date().getFullYear(), 1);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-off-white">
      <div className="text-center max-w-2xl">
        <Image
          src="/images/logo.jpg"
          alt="ABAK Engineering Consultancy"
          width={220}
          height={170}
          className="mx-auto mb-8 rounded-lg"
          priority
        />
        <h1 className="text-4xl font-bold mb-4 text-abak-blue">ABAK ERP System</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Engineering Consultancy Management Platform
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/login" className="btn-primary">
            Login
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            Dashboard
          </Link>
          <Link href="/register" className="btn-outline">
            Register
          </Link>
        </div>
        <p className="mt-12 text-sm text-muted-foreground">
          Sample entity ID (from <code className="font-mono">shared-utils</code>):{' '}
          <span className="badge-active font-mono">{sampleId}</span>
        </p>
      </div>
    </main>
  );
}
