// pages/api/corrigirDadosTurma.ts

import type { NextApiRequest, NextApiResponse } from 'next';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
        const response = await fetch('https://script.google.com/macros/s/AKfycbyiPJ3luMR_u-H0UuUbLjodPTXM4zgKzH4RxXOCcxjYnBn3HWRR3V30D9yjCZzilBgegg/exec', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(req.body)
        });
  
        const data = await response.json();
  
        res.status(200).json({ status: 'Success', data: data });
      } catch (error) {
        res.status(500).json({ status: 'Failed', message: 'Internal Server Error' });
      }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
