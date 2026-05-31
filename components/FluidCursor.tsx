'use client';
import { useEffect } from 'react';

import fluidCursor from '@/hooks/use-FluidCursor';

const FluidCursor = () => {
    useEffect(() => {
        try {
            fluidCursor();
        } catch (e) {
            console.warn('FluidCursor init skipped:', e);
        }
    }, []);

    return (
        <div className='absolute inset-0 z-[2] pointer-events-none'>
            <canvas id='fluid' className='w-full h-full' />
        </div>
    );
};
export default FluidCursor;
