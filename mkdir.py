import os
import re
import sys

def read_input():
    """读取用户输入的项目结构"""
    lines = []
    print("请输入项目结构（输入完成后按Ctrl+D/Linux/Mac或Ctrl+Z/Windows结束输入，空行忽略，...行忽略）：")
    for line in sys.stdin:
        line = line.strip('\n').rstrip()  # 去掉换行符和行尾空格
        if not line:
            continue
        lines.append(line)
    return lines

def parse_line(line):
    """解析单行，返回（depth, name, is_folder）或None"""
    # 跳过包含...的行
    if '...' in line:
        return None
    # 提取名称部分
    match = re.match(r'^[\s├└│─]*([^\s├└│─].*)$', line)
    if not match:
        # 没有匹配到，直接取处理后的行作为名称
        name = line.strip()
    else:
        name = match.group(1).strip()
    if not name:
        return None
    # 判断是否是文件夹（以/结尾）
    is_folder = False
    if name.endswith('/'):
        is_folder = True
        name = name[:-1].strip()  # 去掉/
    if not name:
        return None
    # 计算缩进深度（每4个空格为一层）
    prefix_len = len(line) - len(line.lstrip(' \t├└│─'))
    prefix_spaces = re.sub(r'[^\s]', ' ', line[:prefix_len])
    depth = len(prefix_spaces) // 4
    return (depth, name, is_folder)

def main():
    """主函数：处理输入并创建项目结构"""
    # 读取输入
    lines = read_input()
    if not lines:
        print("错误：没有输入项目结构！")
        return

    # 初始化栈，保存文件夹路径，索引对应层级（栈[0]是层级0的文件夹路径）
    stack = []
    for line in lines:
        parsed = parse_line(line)
        if not parsed:
            continue
        depth, name, is_folder = parsed
        try:
            if is_folder:
                # 调整栈到指定深度（父级为栈[depth-1]）
                stack = stack[:depth]
                # 计算文件夹路径
                if depth == 0:
                    folder_path = name
                else:
                    if len(stack) < depth:
                        print(f"警告：层级{depth}的父级不存在，跳过文件夹 {name}")
                        continue
                    folder_path = os.path.join(stack[depth-1], name)
                # 创建文件夹（存在则忽略）
                os.makedirs(folder_path, exist_ok=True)
                print(f"✅ 创建文件夹：{folder_path}")
                # 更新栈
                if len(stack) <= depth:
                    stack.append(folder_path)
                else:
                    stack[depth] = folder_path
            else:
                # 处理文件
                stack = stack[:depth]
                # 计算文件路径
                if depth == 0:
                    file_path = name
                else:
                    if len(stack) < depth:
                        print(f"警告：层级{depth}的父级不存在，跳过文件 {name}")
                        continue
                    file_path = os.path.join(stack[depth-1], name)
                # 确保父文件夹存在
                parent_dir = os.path.dirname(file_path)
                if parent_dir:
                    os.makedirs(parent_dir, exist_ok=True)
                # 创建空文件
                with open(file_path, 'w') as f:
                    pass
                print(f"✅ 创建文件：{file_path}")
        except Exception as e:
            print(f"❌ 创建失败 {name}：{str(e)}")

if __name__ == "__main__":
    main()