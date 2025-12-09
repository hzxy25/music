import os
import sys


def generate_tree(current_path: str, prefix: str, exclude_list: list) -> None:
    """
    递归生成项目树形结构

    Args:
        current_path: 当前遍历的目录路径
        prefix: 前缀符号，用于控制树形结构的排版
        exclude_list: 需排除的目录/文件名称列表
    """
    # 列出当前目录下的所有条目，过滤排除项和符号链接（避免循环引用）
    entries = []
    for entry in os.listdir(current_path):
        if entry in exclude_list:
            continue
        entry_path = os.path.join(current_path, entry)
        # 排除符号链接（可选，若需保留符号链接可注释此行）
        if os.path.islink(entry_path):
            continue
        entries.append(entry)

    # 排序：文件夹在前，文件在后；同类型按名称升序排列
    entries.sort(key=lambda x: (
        not os.path.isdir(os.path.join(current_path, x)),  # 文件夹优先级高
        x.lower()  # 名称不区分大小写排序
    ))

    # 遍历处理每个条目
    entry_count = len(entries)
    for index, entry in enumerate(entries):
        entry_path = os.path.join(current_path, entry)
        is_last = index == entry_count - 1  # 是否为最后一个条目

        # 构建当前行的符号前缀
        if is_last:
            entry_symbol = "└── "
            next_prefix = prefix + "    "  # 下一级前缀（最后一个条目后无竖线）
        else:
            entry_symbol = "├── "
            next_prefix = prefix + "│   "  # 下一级前缀（非最后一个条目后保留竖线）

        # 输出当前条目（文件夹加/，文件直接显示）
        if os.path.isdir(entry_path):
            print(f"{prefix}{entry_symbol}{entry}/")
            # 递归处理子目录
            generate_tree(entry_path, next_prefix, exclude_list)
        else:
            print(f"{prefix}{entry_symbol}{entry}")


def main():
    """主函数：处理输入参数并启动树形结构生成"""
    # 获取项目路径（优先命令行参数，无则手动输入）
    if len(sys.argv) > 1:
        project_path = sys.argv[1].strip()
    else:
        project_path = input("请输入项目路径：").strip()

    # 校验路径有效性
    if not os.path.exists(project_path):
        print(f"❌ 错误：路径「{project_path}」不存在！")
        return
    if not os.path.isdir(project_path):
        print(f"❌ 错误：「{project_path}」不是有效的目录！")
        return

    # 定义默认排除的冗余目录/文件（可根据需求调整）
    exclude_list = [
        "__pycache__", ".git", "node_modules", ".venv", "venv",
        ".idea", ".vscode", "dist", "build", ".gitignore",
        "*.pyc", "*.pyo", "*.pyd", ".DS_Store", "Thumbs.db"
    ]

    # 输出根目录名称
    project_abs_path = os.path.abspath(project_path)
    root_name = os.path.basename(project_abs_path)
    print(f"{root_name}/")

    # 递归生成树形结构
    generate_tree(project_abs_path, "", exclude_list)


if __name__ == "__main__":
    main()