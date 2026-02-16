"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import type { DateRangeFilterValue } from "@/components/dashboard/date-range-filter";

interface DashboardFilterContextType {
  dateFilter: DateRangeFilterValue;
  setDateFilter: (value: DateRangeFilterValue) => void;
}

const DashboardFilterContext = createContext<DashboardFilterContextType | undefined>(undefined);

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const [dateFilter, setDateFilter] = useState<DateRangeFilterValue>({
    preset: "7days",
  });

  return (
    <DashboardFilterContext.Provider value={{ dateFilter, setDateFilter }}>
      {children}
    </DashboardFilterContext.Provider>
  );
}

export function useDashboardFilter() {
  const context = useContext(DashboardFilterContext);
  if (context === undefined) {
    throw new Error("useDashboardFilter must be used within a DashboardFilterProvider");
  }
  return context;
}
