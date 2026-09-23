// Supabase Edge Function: notify
// Sends the owner an email (via Resend) whenever a visitor submits something new.
// Deployed and triggered entirely from the Supabase dashboard — see the setup guide.

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const webhookSecret = Deno.env.get('WEBHOOK_SECRET') || '';
  const auth = req.headers.get('Authorization') || '';
  if (!webhookSecret || auth !== `Bearer ${webhookSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const type = payload && payload.type;
  const table = payload && payload.table;
  const record = payload && payload.record;
  if (type !== 'INSERT' || !table || !record) {
    return new Response('ignored', { status: 200 });
  }

  const SITE = 'مليحة العطش';
  const CAT_NAMES: Record<string, string> = {
    story: 'قصة', article: 'مقال', event: 'حدث', news: 'خبر عاجل',
    martyr: 'اسم بقسم شهداء الثورة السورية', general_death: 'اسم بقسم وفيات عامة',
    team_news: 'خبر عن الفريق التطوعي', team_roster: 'اقتراح عضو بالفريق التطوعي',
  };

  let subject = '';
  let text = '';

  if (table === 'posts') {
    if (record.status !== 'pending') return new Response('ok', { status: 200 });
    const kind = CAT_NAMES[record.type as string] || 'مشاركة';
    subject = `[${SITE}] ${kind} جديدة بانتظار المراجعة`;
    text = `النوع: ${kind}\nالعنوان: ${record.title || '(بدون عنوان)'}\n\nادخل إلى لوحة تحكم الموقع للمراجعة والنشر.`;
  } else if (table === 'reviews') {
    if (record.status !== 'pending') return new Response('ok', { status: 200 });
    subject = `[${SITE}] رأي جديد بانتظار المراجعة`;
    text = `من: ${record.name || 'زائر'}\nالتقييم: ${record.rating != null ? record.rating + ' / 5' : ''}\n${record.comment ? '\n' + record.comment + '\n' : ''}\nادخل إلى لوحة تحكم الموقع للمراجعة.`;
  } else if (table === 'comments') {
    if (record.status !== 'pending') return new Response('ok', { status: 200 });
    subject = `[${SITE}] تعليق جديد بانتظار المراجعة`;
    text = `من: ${record.name || 'زائر'}\n\n${record.body || ''}\n\nادخل إلى لوحة تحكم الموقع للمراجعة.`;
  } else if (table === 'service_suggestions') {
    subject = `[${SITE}] اقتراح خدمة جديد`;
    text = `الاسم: ${record.name || ''}\nالمهنة: ${record.role || ''}\nالهاتف: ${record.phone || ''}\n\nادخل إلى لوحة تحكم الموقع للمراجعة.`;
  } else if (table === 'ads') {
    if (record.status !== 'pending') return new Response('ok', { status: 200 });
    subject = `[${SITE}] إعلان جديد بانتظار المراجعة`;
    text = `العنوان: ${record.title || ''}\nمقدَّم من: ${record.seller || ''}\n\nادخل إلى لوحة تحكم الموقع للمراجعة.`;
  } else if (table === 'messages') {
    subject = `[${SITE}] لديك رسالة خاصة جديدة`;
    text = `من: ${record.name || 'زائر'}\nللتواصل: ${record.contact || ''}\n\n${record.body || ''}\n\nافتح صندوق الرسائل من لوحة تحكم الموقع لقراءتها.`;
  } else {
    return new Response('ignored table', { status: 200 });
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('NOTIFY_EMAIL');
  if (!apiKey || !to) {
    console.error('missing RESEND_API_KEY or NOTIFY_EMAIL secret');
    return new Response('missing config', { status: 500 });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${SITE} <onboarding@resend.dev>`,
        to: [to],
        subject,
        text,
      }),
    });
    if (!r.ok) {
      const errBody = await r.text();
      console.error('resend send failed', r.status, errBody);
      return new Response('resend error', { status: 502 });
    }
  } catch (e) {
    console.error('resend request threw', e);
    return new Response('send failed', { status: 502 });
  }

  return new Response('ok', { status: 200 });
});
