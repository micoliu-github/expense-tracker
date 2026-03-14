/**
 * A Button wrapper that shows a small tooltip with a ? icon on hover.
 * Usage:
 *   <ButtonWithTooltip tooltip="Exports this month's data to an Excel file." ...buttonProps>
 *     Export XLSX
 *   </ButtonWithTooltip>
 */
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

interface ButtonWithTooltipProps extends ComponentProps<typeof Button> {
  tooltip: string;
  children: React.ReactNode;
}

export function ButtonWithTooltip({ tooltip, children, className, ...props }: ButtonWithTooltipProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button className={cn("gap-1.5", className)} {...props}>
            {children}
            <HelpCircle className="h-3 w-3 opacity-40 shrink-0" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-56 text-xs leading-relaxed">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
