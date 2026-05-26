import { NextRequest, NextResponse } from 'next/server';

// Captura o IP do cliente para assinaturas digitais do Conselho Fiscal.
// Utilizado por financial_fiscal_signatures.ip_address.
export function GET(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    null;
  return NextResponse.json({ ip });
}
