import toast from "react-hot-toast";

export function showCartSuccessToast() {
  toast.success("Added to cart successfully!", {
    id: "joro-cart-added",
    duration: 2500,
    position: "top-center",
    iconTheme: { primary: "#008F3B", secondary: "#FFFFFF" },
  });
}
