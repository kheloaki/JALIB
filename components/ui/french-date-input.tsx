"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { formatDateFr } from "@/lib/dates/format-date";
import { cn } from "@/lib/utils";

type FrenchDateInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "onChange" | "readOnly"
> & {
  value: string;
  onValueChange?: (value: string) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
};

function openNativeDatePicker(input: HTMLInputElement | null) {
  if (!input || input.disabled) return;
  try {
    input.showPicker();
  } catch {
    input.click();
  }
}

const FrenchDateInput = React.forwardRef<HTMLInputElement, FrenchDateInputProps>(
  function FrenchDateInput(
    {
      value,
      onValueChange,
      onChange,
      className,
      disabled,
      required,
      id,
      name,
      min,
      max,
      placeholder = "jj/mm/aaaa",
      ...props
    },
    ref,
  ) {
    const hiddenRef = React.useRef<HTMLInputElement>(null);
    const display = value ? formatDateFr(value) : "";

    React.useImperativeHandle(ref, () => hiddenRef.current as HTMLInputElement);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange?.(event.target.value);
      onChange?.(event);
    };

    return (
      <div className="relative w-full min-w-0">
        <Input
          readOnly
          value={display}
          placeholder={placeholder}
          disabled={disabled}
          aria-labelledby={id}
          onClick={() => openNativeDatePicker(hiddenRef.current)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openNativeDatePicker(hiddenRef.current);
            }
          }}
          className={cn("cursor-pointer tabular-nums", className)}
          {...props}
        />
        <input
          ref={hiddenRef}
          type="date"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          id={id}
          name={name}
          min={min}
          max={max}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0"
        />
      </div>
    );
  },
);

export { FrenchDateInput };
