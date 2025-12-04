import NextAuth from 'next-auth'
import CredentialsProvider from "next-auth/providers/credentials"


export const authOptions = {
  // Configure one or more authentication providers
  providers: [
    CredentialsProvider({
        name: "Credentials",
        credentials: {
          username: { label: "Username", type: "text" },
          password: { label: "Password", type: "password" },
        },
        authorize: async (credentials) => {
          // Implementar a lógica de autenticação aqui
          if (
            (credentials!.username === "admin" && credentials!.password === "adminpass") ||
            (credentials!.username === "professor" && credentials!.password === "rizzosports#")
          ) {
            return {
              id: credentials!.username,
              name: credentials!.username,
              role: credentials!.username === "admin" ? "admin" : "professor",
            };
          }
          return null;
        },
      }),
  ],
  callbacks: {
     // @ts-ignore
    jwt: async ({ token, user }) => {
      // Assumindo que o objeto `user` é retornado pelo `authorize` e contém uma `role`
      if (user?.role) {
        token.role = user.role;
      }
      return token;
    },
     // @ts-ignore
    session: async ({ session, token }) => {
      // Assumindo que o objeto `token` inclui a `role`
      if (token.role) {
        session.user.role = token.role;
      }
      return session;
    },
  },
  secret: "sdjafhsdjkfhsdjkhfsdjksdfh"
}

export default NextAuth(authOptions);


  // @ts-ignore
