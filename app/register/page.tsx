import Link from 'next/link';
import RegisterForm from './RegisterForm';
import { Suspense } from 'react';

export default function RegisterPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: '600px', width: '100%' }}>
        <h1 style={{ fontSize: '26px' }}><span className="logo-nest">Nest</span><span className="logo-ly">ly</span></h1>
        <p className="subtitle">Create your account in seconds.</p>
        <Suspense fallback={<div>Loading...</div>}>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
