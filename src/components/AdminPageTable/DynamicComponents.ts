// DynamicComponents.ts

import dynamic from 'next/dynamic';


export const ControleFrequenciaTableNoSSR = dynamic(() => import('./ControleFrequenciaTable'), {
    ssr: false,
});

export const TurmasInfoTableNoSSR = dynamic(() => import('./TurmasInfoTable'), {
    ssr: false,
});
