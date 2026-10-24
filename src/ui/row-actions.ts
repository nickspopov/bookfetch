import { ActionSheetIOS, Alert, Platform, type AccessibilityActionEvent } from 'react-native';

export interface RowAction {
  /** stable name for the accessibility action */
  name: string;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

/**
 * Long-press menu for a list row: the native action sheet on iOS, an alert on Android (which takes at most
 * three buttons, so at most two actions plus Cancel).
 */
export function showRowActions(title: string, message: string, actions: RowAction[]) {
  if (Platform.OS === 'ios') {
    const destructiveButtonIndex = actions
      .map((action, index) => (action.destructive ? index : -1))
      .filter((index) => index >= 0);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: [...actions.map((a) => a.label), 'Cancel'],
        cancelButtonIndex: actions.length,
        destructiveButtonIndex,
      },
      (index) => actions[index]?.onPress(),
    );
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    ...actions.slice(0, 2).map((a) => ({
      text: a.label,
      style: a.destructive ? ('destructive' as const) : ('default' as const),
      onPress: a.onPress,
    })),
  ]);
}

/** The same actions for VoiceOver / TalkBack (rotor or actions menu). */
export function accessibilityActionsFor(actions: RowAction[]) {
  return {
    accessibilityActions: actions.map((a) => ({ name: a.name, label: a.label })),
    onAccessibilityAction: (event: AccessibilityActionEvent) =>
      actions.find((a) => a.name === event.nativeEvent.actionName)?.onPress(),
  };
}
