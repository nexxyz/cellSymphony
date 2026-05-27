use std::path::Path;

fn main() {
    let src_path = Path::new("src");

    println!("cargo::rerun-if-changed=src/wrapper.h");
    println!("cargo::rerun-if-changed=src/wrapper.cpp");
    println!("cargo::rerun-if-changed=signalsmith-stretch/signalsmith-stretch.h");

    cc::Build::new()
        .file(src_path.join("wrapper.cpp"))
        .include(Path::new("signalsmith-stretch"))
        .include(Path::new("."))
        .cpp(true)
        .std("c++14")
        .compile("signalsmith-stretch");
}
