import {
  STORE_LOGO_FULL_PATH,
  STORE_LOGO_ICON_PATH,
  STORE_LOGO_PATH,
  STORE_LOGO_PRINT_FULL_PATH,
  STORE_LOGO_PRINT_PATH,
  STORE_LOGO_WHITE_PATH,
  STORE_NAME,
} from "@/lib/brand/constants";
import { cn } from "@/lib/utils";

const sizeClass = {
  xs: "h-7",
  sm: "h-9",
  md: "h-14",
  lg: "h-[72px]",
  /** ~14mm tall — fits 80mm thermal tickets without slow decode */
  thermal: "h-11 max-h-[14mm]",
  print: "h-[100px]",
} as const;

const fullSizeClass = {
  xs: "h-10",
  sm: "h-12",
  md: "h-16",
  lg: "h-24",
  thermal: "h-10 max-h-[12mm]",
  print: "h-28",
} as const;

type StoreLogoVariant =
  | "icon"
  | "full"
  | "white"
  | "print"
  | "printFull"
  | "default";

type StoreLogoProps = {
  variant?: StoreLogoVariant;
  size?: keyof typeof sizeClass;
  className?: string;
  priority?: boolean;
};

function resolveLogoPath(variant: StoreLogoVariant) {
  switch (variant) {
    case "icon":
      return STORE_LOGO_ICON_PATH;
    case "full":
      return STORE_LOGO_FULL_PATH;
    case "white":
      return STORE_LOGO_WHITE_PATH;
    case "print":
      return STORE_LOGO_PRINT_PATH;
    case "printFull":
      return STORE_LOGO_PRINT_FULL_PATH;
    default:
      return STORE_LOGO_PATH;
  }
}

export function StoreLogo({
  variant = "default",
  size = "md",
  className,
  priority,
}: StoreLogoProps) {
  const isWordmark = variant === "full" || variant === "printFull";
  const isStacked = variant === "white" || variant === "print";
  const usesWidthLayout = isWordmark || variant === "white";
  const src = resolveLogoPath(variant);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- used in print/PDF clones
    <img
      src={src}
      alt={STORE_NAME}
      width={isWordmark ? 623 : isStacked ? 389 : 256}
      height={isWordmark ? 220 : isStacked ? 400 : 256}
      decoding="sync"
      fetchPriority={priority ? "high" : "auto"}
      className={cn(
        "w-auto max-w-full shrink-0 object-contain bg-transparent",
        usesWidthLayout ? fullSizeClass[size] : sizeClass[size],
        usesWidthLayout && "h-auto w-full",
        className,
      )}
    />
  );
}
