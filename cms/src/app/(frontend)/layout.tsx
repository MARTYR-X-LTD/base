import React from 'react'
import './styles.css'
import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/constants'

export const metadata = {
  description: SITE_DESCRIPTION,
  title: SITE_NAME,
  icons: {
    icon: '/favicon.svg',
  },
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
