import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gestão Eklesia - Login',
  description: 'Administração Ministerial Inteligente',
  robots: {
    index: false,
    follow: false,
  },
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
