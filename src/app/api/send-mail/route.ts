import { NextRequest } from 'next/server';
import { sendMail } from '@/lib/mail';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { to, subject, text } = body;
  
  if (!to || !subject || !text) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }

  try {
    await sendMail({ to, subject, text });
    return new Response(JSON.stringify({ message: 'Email sent successfully' }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
