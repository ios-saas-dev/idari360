'use client';

import { useEffect, useState } from 'react';

/**
 * Dokunmatik cihaz tespiti: kaba işaretçi veya mobil tarayıcı.
 * Mobil özel butonların (ör. kamera ile çek) gösterilmesi için kullanılır.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    try {
      const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const mobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsMobile(coarsePointer || mobileUA);
    } catch {
      // yoksay
    }
  }, []);

  return isMobile;
}
