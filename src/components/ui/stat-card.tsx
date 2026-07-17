import React from "react";
import { Card, CardContent } from "./card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, icon: Icon, trend, className }: StatCardProps) {
  return (
    <Card className={className}>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-stone-500 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-3xl font-display font-bold text-brand-950">{value}</h4>
            {trend && (
              <span className={`text-xs font-semibold ${trend.isPositive ? 'text-success' : 'text-danger'}`}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
            )}
          </div>
        </div>
        <div className="h-12 w-12 rounded-full bg-brand-50 flex items-center justify-center">
          <Icon className="h-6 w-6 text-brand-700" />
        </div>
      </CardContent>
    </Card>
  );
}
