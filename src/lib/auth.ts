/**
 * 🔐 NextAuth Configuration
 * Продакшн-ready аутентификация для admin панели
 */

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

// Admin credentials interface
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin';
  passwordHash: string;
}

// 🔐 SECURITY: Admin credentials from environment variables ONLY
// NO HARDCODED PASSWORDS - Critical security requirement

/**
 * Get admin user configuration with runtime validation
 * This function is called only when needed, not during build time
 */
function getAdminUser(): AdminUser {
  // ✅ RUNTIME VALIDATION: Check environment variables when actually needed
  if (!process.env.ADMIN_PASSWORD_HASH) {
    throw new Error('🚨 CRITICAL SECURITY ERROR: ADMIN_PASSWORD_HASH environment variable is required');
  }

  if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET === 'build-time-placeholder') {
    throw new Error('🚨 CRITICAL SECURITY ERROR: NEXTAUTH_SECRET environment variable is required');
  }

  return {
    id: '1',
    email: process.env.ADMIN_EMAIL || 'admin@canton-otc.com',
    passwordHash: process.env.ADMIN_PASSWORD_HASH,
    name: process.env.ADMIN_NAME || 'Admin',
    role: 'admin' as const
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // ✅ CRITICAL: Required for production behind proxy
  useSecureCookies: process.env.NODE_ENV === 'production',
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-authjs.session-token' : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NODE_ENV === 'production' ? undefined : undefined
      }
    }
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        console.log('🔐 Auth attempt:', { email: credentials?.email, hasPassword: !!credentials?.password });
        
        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Missing credentials');
          return null;
        }

        try {
          // ✅ RUNTIME VALIDATION: Get admin user with environment validation
          const adminUser = getAdminUser();
          
          console.log('📧 Looking for user:', credentials.email);
          console.log('👤 Admin user configured:', { email: adminUser.email, hasHash: !!adminUser.passwordHash });

          // Check if credentials match admin user
          if (adminUser.email !== credentials.email) {
            console.warn('❌ Login attempt with non-admin email:', credentials.email);
            return null;
          }

          console.log('👤 Found admin user:', { email: adminUser.email, hashLength: adminUser.passwordHash.length });

          // ✅ SECURITY: Verify password using bcrypt
          const isValid = await bcrypt.compare(
            credentials.password as string,
            adminUser.passwordHash
          );

          console.log('🔑 Password validation result:', isValid);

          if (!isValid) {
            console.warn('❌ Failed login attempt for:', credentials.email);
            return null;
          }

          console.log('✅ Successful admin login:', adminUser.email);

          return {
            id: adminUser.id,
            email: adminUser.email,
            name: adminUser.name,
            role: adminUser.role
          };
        } catch (error) {
          console.error('🚨 Authentication error:', error);
          return null;
        }
      }
    })
  ],
  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      console.log('🔑 JWT callback:', { hasUser: !!user, hasToken: !!token, tokenId: token?.id });
      if (user) {
        token.id = user.id;
        token.role = (user as AdminUser).role;
        console.log('✅ JWT token updated:', { id: token.id, role: token.role });
      }
      return token;
    },
    async session({ session, token }) {
      console.log('📋 Session callback:', { hasSession: !!session, hasToken: !!token, tokenId: token?.id });
      if (session.user) {
        // Safely assign properties to session.user
        Object.assign(session.user, {
          id: token.id as string,
          role: token.role as 'admin'
        });
        console.log('✅ Session updated:', { id: session.user.id });
      }
      return session;
    }
  },
  session: {
    strategy: 'jwt' as const,
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET || 'build-time-placeholder'
});


