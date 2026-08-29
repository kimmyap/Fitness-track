/** Settings accordion section (legacy gt-accordion pattern, keyboard/ARIA-correct). */
import { useId } from 'react';
import styled from '@emotion/styled';
import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const Section = styled.section`
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.cardForeground};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  overflow: hidden;
`;

const Header = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[3]};
  width: 100%;
  min-height: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[3]} ${theme.space[4]}`};
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  color: ${({ theme }) => theme.colors.cardForeground};
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
  font-weight: 600;
`;

const TitleWrap = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
`;

const Chevron = styled(ChevronDown, { shouldForwardProp: (p) => p !== 'open' })<{ open: boolean }>`
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.mutedForeground};
  transform: rotate(${({ open }) => (open ? '180deg' : '0deg')});
  transition: transform ${({ theme }) => `${theme.motion.duration.fast} ${theme.motion.easing.out}`};
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => `0 ${theme.space[4]} ${theme.space[4]}`};
`;

export interface AccordionSectionProps {
  title: string;
  icon?: LucideIcon;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function AccordionSection({ title, icon: Icon, open, onToggle, children }: AccordionSectionProps) {
  const id = useId();
  const bodyId = `${id}-body`;
  return (
    <Section>
      <Header type="button" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <TitleWrap>
          {Icon ? <Icon size={18} aria-hidden="true" /> : null}
          {title}
        </TitleWrap>
        <Chevron size={18} aria-hidden="true" open={open} />
      </Header>
      {open ? <Body id={bodyId}>{children}</Body> : null}
    </Section>
  );
}
