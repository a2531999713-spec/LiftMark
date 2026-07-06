"""下载品牌 Logo 到 public 目录"""
import urllib.request
import os

url = "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=A%20modern%20minimalist%20logo%20for%20a%20fitness%20gym%20training%20app%20called%20LiftMark.%20Features%20a%20stylized%20barbell%20or%20dumbbell%20icon%20combined%20with%20a%20checkmark%20or%20upward%20arrow%2C%20symbolizing%20progress%20and%20achievement.%20Dark%20navy%20blue%20and%20coral%20orange%20color%20scheme.%20Clean%20vector-style%20design%20on%20transparent%20background.%20Professional%20brand%20identity.%20Square%20format.&image_size=square_hd"

output_dir = r'c:\Users\zhw\Documents\LiftMark\backend\public'
output_path = os.path.join(output_dir, 'logo.png')

print(f"下载 Logo 到: {output_path}")
urllib.request.urlretrieve(url, output_path)
size_kb = os.path.getsize(output_path) / 1024
print(f"完成! 文件大小: {size_kb:.1f} KB")
