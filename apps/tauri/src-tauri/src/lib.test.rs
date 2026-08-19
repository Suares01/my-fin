#[cfg(test)]
mod tests {
    #[test]
    fn package_uses_the_approved_product_name() {
        assert_eq!(env!("CARGO_PKG_NAME"), "my-fin-tauri");
    }

    #[test]
    fn package_uses_the_approved_binary_version() {
        assert_eq!(env!("CARGO_PKG_VERSION"), "0.1.0");
    }
}
