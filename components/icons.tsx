import {
  LightningIcon,
  CompassIcon,
  PackageIcon,
  CubeIcon,
  DatabaseIcon,
  WrenchIcon,
  type IconProps,
} from "@phosphor-icons/react";
import type { CategoryIconKey } from "@/lib/detectors/types";

const CATEGORY_ICONS: Record<
  CategoryIconKey,
  React.ComponentType<IconProps>
> = {
  runtime: LightningIcon,
  "version-manager": CompassIcon,
  "package-manager": PackageIcon,
  container: CubeIcon,
  database: DatabaseIcon,
  "base-tool": WrenchIcon,
};

/** 工具分类图标：全站统一从 CATEGORY_META.icon(key) 渲染 Phosphor 图标 */
export function CategoryIcon({
  name,
  ...props
}: { name: CategoryIconKey } & IconProps) {
  const Icon = CATEGORY_ICONS[name] ?? WrenchIcon;
  return <Icon {...props} />;
}
