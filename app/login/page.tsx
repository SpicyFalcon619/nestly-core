import Link from 'next/link';
import LoginForm from './LoginForm';
import { Suspense } from 'react';

export default function LoginPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: '500px', width: '100%' }}>
        <h1 style={{ fontSize: '26px' }}><span className="logo-nest">Nest</span><span className="logo-ly">ly</span></h1>
        <p className="subtitle">Welcome back. Log in to continue.</p>
        <Suspense fallback={<div>Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
