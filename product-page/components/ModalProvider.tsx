'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import BenefitModal from './BenefitModal';
import SimpleModal, { B2BModalContent, BlogModalContent } from './SimpleModal';
import type { BenefitModalData, BenefitModalType } from '@/lib/content/types';

interface ModalContextValue {
  openBenefitModal: (type: BenefitModalType) => void;
  openB2BModal: () => void;
  openBlogModal: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModalContext() {
  return useContext(ModalContext);
}

interface ModalProviderProps {
  children: ReactNode;
  benefitModals?: BenefitModalData[];
}

export default function ModalProvider({ children, benefitModals = [] }: ModalProviderProps) {
  const [openBenefit, setOpenBenefit] = useState<BenefitModalType | null>(null);
  const [openB2B, setOpenB2B] = useState(false);
  const [openBlog, setOpenBlog] = useState(false);

  const selectedBenefit = benefitModals.find(m => m.type === openBenefit);

  const openBenefitModal = useCallback((type: BenefitModalType) => {
    setOpenBenefit(type);
  }, []);

  const openB2BModal = useCallback(() => {
    setOpenB2B(true);
  }, []);

  const openBlogModal = useCallback(() => {
    setOpenBlog(true);
  }, []);

  const contextValue: ModalContextValue = {
    openBenefitModal,
    openB2BModal,
    openBlogModal,
  };

  return (
    <ModalContext.Provider value={contextValue}>
      {children}

      {selectedBenefit && (
        <BenefitModal data={selectedBenefit} onClose={() => setOpenBenefit(null)} />
      )}
      {openB2B && (
        <SimpleModal title="Зазначений розділ у розробці" onClose={() => setOpenB2B(false)}>
          <B2BModalContent onClose={() => setOpenB2B(false)} />
        </SimpleModal>
      )}
      {openBlog && (
        <SimpleModal title="Розділ сайту в розробці" onClose={() => setOpenBlog(false)}>
          <BlogModalContent />
          <button
            type="button"
            onClick={() => setOpenBlog(false)}
            className="mt-4 flex h-[48px] w-full items-center justify-center rounded-[12px] bg-black text-[16px] font-semibold text-white transition-colors hover:bg-gray-800"
          >
            Зрозуміло
          </button>
        </SimpleModal>
      )}
    </ModalContext.Provider>
  );
}
