import { StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";

type FieldLabelProps = {
  label: string;
  required?: boolean;
};

export function FieldLabel({ label, required = false }: FieldLabelProps) {
  return (
    <View style={styles.labelCol}>
      <View style={styles.labelRow}>
        <Text style={styles.labelText}>{label}</Text>
        {required ? <Text style={styles.required}>*</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelCol: {
    width: 65,
    paddingVertical: 4,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  labelText: {
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    color: "#DEDEE0",
  },
  required: {
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    color: "#FE4267",
  },
});
