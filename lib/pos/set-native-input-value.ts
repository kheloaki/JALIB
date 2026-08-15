/** Updates a controlled React input/textarea from outside React (virtual keyboard). */
export function setNativeInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  const setter = descriptor?.set;
  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
}
