import { Eye24Regular, EyeOff24Regular } from "@fluentui/react-native-icons";

type PasswordVisibilityIconProps = {
  visible: boolean;
  size: number;
};

export function PasswordVisibilityIcon({
  visible,
  size,
}: PasswordVisibilityIconProps) {
  const Icon = visible ? Eye24Regular : EyeOff24Regular;

  return <Icon accessible={false} color="#999999" width={size} height={size} />;
}
