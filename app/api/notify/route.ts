import { Resend } from 'resend';
import { NextResponse } from 'next/server';

let resendClient: Resend | null = null;

function getResend() {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error('RESEND_API_KEY is required');
    }
    resendClient = new Resend(key);
  }
  return resendClient;
}

export async function POST(request: Request) {
  try {
    const { decision, recommended_fee, reasoning, parsed_input, action_type, response_message } = await request.json();
    const recipient = process.env.NOTIFICATION_EMAIL || 'dain.russell@gmail.com';

    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: 'Signing Agent Assistant <onboarding@resend.dev>',
      to: [recipient],
      subject: `[${action_type}] Job Decision: ${decision}`,
      html: `
        <h2>Job Decision: ${decision}</h2>
        <p><strong>Action Type:</strong> ${action_type.replace('_', ' ')}</p>
        <p><strong>Recommended Fee:</strong> $${recommended_fee}</p>
        <p><strong>Reasoning:</strong> ${reasoning}</p>
        <hr />
        <h3>Response Message:</h3>
        <p><em>${response_message}</em></p>
        <hr />
        <h3>Extracted Details:</h3>
        <ul>
          <li><strong>Offered Fee:</strong> $${parsed_input.offered_fee}</li>
          <li><strong>Distance:</strong> ${parsed_input.distance_miles} miles</li>
          <li><strong>Time:</strong> ${parsed_input.time_type.replace('_', ' ')}</li>
          <li><strong>Document Type:</strong> ${parsed_input.document_type}</li>
        </ul>
      `,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
