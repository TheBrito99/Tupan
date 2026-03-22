/**
 * Tabs Component - Reusable tab system for CAM Workbench
 * Phase 19 Task 6: CAM UI & Integration
 */

import React, { ReactNode } from 'react';
import styles from './Tabs.module.css';

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}

interface TabsListProps {
  children: ReactNode;
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
}

interface TabsContentProps {
  value: string;
  className?: string;
  children: ReactNode;
}

/**
 * Tabs container component
 */
export const Tabs: React.FC<TabsProps> = ({ value, onValueChange, children }) => {
  return (
    <div className={styles.tabsContainer} data-active-tab={value}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as any, { activeTab: value, onTabChange: onValueChange });
        }
        return child;
      })}
    </div>
  );
};

/**
 * Tab list (header) component
 */
export const TabsList: React.FC<TabsListProps & { activeTab?: string; onTabChange?: (value: string) => void }> = ({
  children,
  activeTab,
  onTabChange,
}) => {
  return (
    <div className={styles.tabsList} role="tablist">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as any, { activeTab, onTabChange });
        }
        return child;
      })}
    </div>
  );
};

/**
 * Individual tab trigger component
 */
export const TabsTrigger: React.FC<TabsTriggerProps & { activeTab?: string; onTabChange?: (value: string) => void }> = ({
  value,
  children,
  activeTab,
  onTabChange,
}) => {
  const isActive = activeTab === value;

  return (
    <button
      className={`${styles.tabsTrigger} ${isActive ? styles.active : ''}`}
      onClick={() => onTabChange?.(value)}
      role="tab"
      aria-selected={isActive}
      data-tab-value={value}
    >
      {children}
    </button>
  );
};

/**
 * Tab content component
 */
export const TabsContent: React.FC<TabsContentProps & { activeTab?: string }> = ({
  value,
  className,
  children,
  activeTab,
}) => {
  if (activeTab !== value) {
    return null;
  }

  return (
    <div
      className={`${styles.tabsContent} ${className || ''}`}
      role="tabpanel"
      data-tab-value={value}
    >
      {children}
    </div>
  );
};

export default Tabs;
