
import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { Lock, ArrowRight, Loader2 } from 'lucide-react';
import { BrandLogo } from '../components/Header';
import { api } from '../services/api';

export const LoginPage: React.FC = () => {
  const { login, showToast } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
        const response = await api.login(email, password);
        login(response.token);
    } catch (err) {
        showToast("Invalid credentials or server error", "error");
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F0] flex items-center justify-center p-6">
      <div className="bg-white border border-primary p-12 max-w-md w-full shadow-2xl relative overflow-hidden">
        
        <div className="absolute top-0 right-0 p-4 opacity-10">
            <BrandLogo className="w-32 h-32 text-primary" />
        </div>

        <div className="relative z-10">
            <h1 className="text-3xl font-serif mb-2">Admin Panel</h1>
            <p className="font-mono text-xs uppercase tracking-widest text-gray-500 mb-8">Internal System Access</p>
            
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-[10px] uppercase font-bold tracking-widest mb-2">Email</label>
                    <input 
                        type="email" 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full bg-[#F8F9FA] border-b-2 border-gray-200 p-3 outline-none focus:border-accent transition-colors"
                        required
                        placeholder="admin@ampublishing.de"
                    />
                </div>
                <div>
                    <label className="block text-[10px] uppercase font-bold tracking-widest mb-2">Password</label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-[#F8F9FA] border-b-2 border-gray-200 p-3 outline-none focus:border-accent transition-colors"
                        required
                        placeholder="admin"
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className={`w-full bg-primary text-white py-4 uppercase font-bold text-xs tracking-[0.2em] hover:bg-accent transition-colors flex items-center justify-center gap-3 ${loading ? 'opacity-80 cursor-wait' : ''}`}
                >
                    {loading ? (
                        <>Authenticating <Loader2 size={14} className="animate-spin"/></>
                    ) : (
                        <>'Access System' <Lock size={14} /></>
                    )}
                </button>
            </form>
            
            <div className="mt-8 pt-8 border-t border-gray-100 text-center">
                <p className="text-[10px] text-gray-400 font-mono">Restricted area. All activities logged.</p>
            </div>
        </div>
      </div>
    </div>
  );
};
