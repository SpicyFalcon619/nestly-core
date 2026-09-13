'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import Link from 'next/link';
import { registerSchema } from '@/lib/schemas';

export default function RegisterForm() {
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get('role') === 'landlord' ? 'landlord' : 'student';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(defaultRole);
  const [gender, setGender] = useState('male');
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate using Zod
    const validation = registerSchema.safeParse({ name, email, password, role, gender });
    
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      setLoading(false);
      return;
    }

    try {
      // The PostgreSQL trigger will automatically create the profile using this metadata
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
            gender,
          }
        }
      });

      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      toast.success('Registration successful! Please log in.');
      router.push('/login');
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during registration');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleRegister}>
      
      <div className="form-group">
        <label>Full name</label>
        <input 
          type="text" 
          placeholder="Enter full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label>Email Address</label>
        <input 
          type="email" 
          placeholder={role === 'student' ? "Enter your email" : "Enter your email"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="grid-2">
        <div className="form-group">
          <label>Password</label>
          <input 
            type="password" 
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div className="form-group">
          <label>Confirm password</label>
          <input 
            type="password" 
            placeholder="Confirm password"
            required
            minLength={6}
          />
        </div>
      </div>

      <div className="form-group">
        <label>I am a…</label>
        <div className="radio-row">
          <label>
            <input 
              type="radio" 
              name="role" 
              value="student" 
              checked={role === 'student'}
              onChange={(e) => setRole(e.target.value)}
            /> Student / Teacher looking for housing
          </label>
          <label>
            <input 
              type="radio" 
              name="role" 
              value="landlord" 
              checked={role === 'landlord'}
              onChange={(e) => setRole(e.target.value)}
            /> Landlord / Mess Owner
          </label>
        </div>
      </div>

      <div className="form-group">
        <label>Gender</label>
        <div className="radio-row">
          <label>
            <input 
              type="radio" 
              name="gender" 
              value="male" 
              checked={gender === 'male'}
              onChange={(e) => setGender(e.target.value)}
            /> Male
          </label>
          <label>
            <input 
              type="radio" 
              name="gender" 
              value="female" 
              checked={gender === 'female'}
              onChange={(e) => setGender(e.target.value)}
            /> Female
          </label>
        </div>
      </div>

      <div className="form-group" style={{ display: role === 'landlord' ? 'none' : 'block' }}>
        <label>Student ID (optional)</label>
        <input type="text" />
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input type="checkbox" required /> I agree to the Terms of Service
        </label>
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
        {loading ? 'Creating Account...' : 'Create Account'}
      </button>
      
      <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '14px' }}>
        Already have an account? <Link href="/login">Log in</Link>
      </div>
    </form>
  );
}
