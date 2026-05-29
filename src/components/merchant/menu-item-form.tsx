
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, XCircle, ImagePlus } from 'lucide-react'; 
import type { MenuItem } from '@/types';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

const menuItemSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  description: z.string().min(1, '描述不能为空'),
  price: z.coerce.number().positive({ message: '价格必须为正数' }),
  imageUrl: z.string().url('请输入有效的图片URL。推荐使用图片上传功能。').or(z.literal('')).optional(),
  dataAiHint: z.string().optional(),
});

export type MenuItemFormData = z.infer<typeof menuItemSchema>;

interface MenuItemFormProps {
  onSubmit: (data: MenuItemFormData) => Promise<void>;
  initialData?: Partial<MenuItem>;
  isLoading: boolean;
  onCancel?: () => void;
}

const PICUI_API_URL = 'https://picui.cn/api/v1/upload';
const PICUI_API_TOKEN = process.env.NEXT_PUBLIC_PICUI_API_TOKEN || '';

interface LastUploadedFileDetails {
  name: string;
  size: number;
  lastModified: number;
  url: string;
}

export default function MenuItemForm({ onSubmit, initialData, isLoading, onCancel }: MenuItemFormProps) {
  const { toast } = useToast();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.imageUrl || null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [lastSuccessfullyUploadedFileDetails, setLastSuccessfullyUploadedFileDetails] = useState<LastUploadedFileDetails | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
    getValues
  } = useForm<MenuItemFormData>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      price: initialData?.price || 0,
      imageUrl: initialData?.imageUrl || '',
      dataAiHint: initialData?.dataAiHint || '',
    },
  });

  const watchedImageUrl = watch('imageUrl');

  useEffect(() => {
    const defaultVals = {
        name: initialData?.name || '',
        description: initialData?.description || '',
        price: initialData?.price || 0,
        imageUrl: initialData?.imageUrl || '',
        dataAiHint: initialData?.dataAiHint || '',
    };
    reset(defaultVals);
    setImagePreview(initialData?.imageUrl || null);
    setImageFile(null);
    setUploadProgress(null);
    setIsUploadingImage(false);
    setLastSuccessfullyUploadedFileDetails(null); 
  }, [initialData, reset]);

  useEffect(() => {
    if (watchedImageUrl && watchedImageUrl !== imagePreview && !imageFile) { // Only update if no local file is active
        setImagePreview(watchedImageUrl);
    }
  }, [watchedImageUrl, imagePreview, imageFile]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (
        lastSuccessfullyUploadedFileDetails &&
        lastSuccessfullyUploadedFileDetails.name === file.name &&
        lastSuccessfullyUploadedFileDetails.size === file.size &&
        lastSuccessfullyUploadedFileDetails.lastModified === file.lastModified
      ) {
        setImageFile(file);
        setImagePreview(lastSuccessfullyUploadedFileDetails.url);
        setValue('imageUrl', lastSuccessfullyUploadedFileDetails.url, { shouldDirty: true, shouldValidate: true });
        setUploadProgress(null);
        setIsUploadingImage(false);
        toast({ title: '图片已重新选择', description: '正在使用此会话中缓存的图片URL。' });
        return;
      }
      setLastSuccessfullyUploadedFileDetails(null); 
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => { setImagePreview(reader.result as string); };
      reader.readAsDataURL(file);
      if (getValues('imageUrl')) {
         setValue('imageUrl', '', { shouldDirty: true, shouldValidate: true });
      } else {
         setValue('imageUrl', '', { shouldValidate: true });
      }
      uploadToPicUI(file);
    } else {
      clearImageSelectionLogic();
    }
  };

  const uploadToPicUI = useCallback(async (fileToUpload: File) => {
    if (!fileToUpload) return;
    if (!PICUI_API_TOKEN) {
      toast({ title: '图片上传未配置', description: '请设置 NEXT_PUBLIC_PICUI_API_TOKEN。', variant: 'destructive' });
      return;
    }
    setIsUploadingImage(true);
    setUploadProgress(0);
    
    const formData = new FormData();
    formData.append('file', fileToUpload);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', PICUI_API_URL, true);
    xhr.setRequestHeader('Authorization', `Bearer ${PICUI_API_TOKEN}`);
    xhr.setRequestHeader('Accept', 'application/json');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      setIsUploadingImage(false);
      setUploadProgress(100); 
      if (xhr.status === 200 || xhr.status === 201) {
        try {
          const response = JSON.parse(xhr.responseText);
          const uploadedUrl = response?.data?.links?.url || response?.data?.url;
          if (uploadedUrl) {
            toast({ title: '图片上传成功!', description: '图片已成功上传至PICUI。' });
            setValue('imageUrl', uploadedUrl, { shouldValidate: true, shouldDirty: true });
            setImagePreview(uploadedUrl); 
            setLastSuccessfullyUploadedFileDetails({
              name: fileToUpload.name,
              size: fileToUpload.size,
              lastModified: fileToUpload.lastModified,
              url: uploadedUrl,
            });
          } else {
            toast({ title: '上传错误', description: '已上传，但无法找到图片URL。', variant: 'destructive' });
            clearImageSelectionLogic(true);
          }
        } catch (e) {
          toast({ title: '上传失败', description: '图片服务器返回无效响应。', variant: 'destructive' });
          clearImageSelectionLogic(true);
        }
      } else {
        let errorMessage = `图片上传失败。状态: ${xhr.status}。`;
         try { const errorResponse = JSON.parse(xhr.responseText); errorMessage = errorResponse?.message || errorMessage; } catch (e) {}
        toast({ title: '上传失败', description: errorMessage, variant: 'destructive' });
        clearImageSelectionLogic(true);
      }
    };
    xhr.onerror = () => {
      setIsUploadingImage(false);
      setUploadProgress(null);
      toast({ title: '上传失败', description: '网络错误或PICUI API无法访问。', variant: 'destructive' });
      clearImageSelectionLogic(true);
    };
    xhr.send(formData);
  }, [setValue, toast, getValues]); 

  const clearImageSelectionLogic = useCallback((uploadFailed = false) => {
    setImageFile(null);
    const initialUrl = initialData?.imageUrl || '';
    const currentFormUrl = getValues('imageUrl');
    
    if (uploadFailed) {
        setImagePreview(initialUrl); 
        if (currentFormUrl !== initialUrl) {
            setValue('imageUrl', initialUrl, { shouldValidate: true, shouldDirty: !!initialUrl });
        } else {
            setValue('imageUrl', initialUrl, { shouldValidate: true });
        }
    } else { // User clicked "Clear"
        setImagePreview(null); // Clear preview immediately
        setValue('imageUrl', '', { shouldValidate: true, shouldDirty: currentFormUrl !== '' });
    }
    
    setUploadProgress(null);
    setIsUploadingImage(false);
    setLastSuccessfullyUploadedFileDetails(null); 
    const fileInput = document.getElementById('imageUpload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }, [initialData?.imageUrl, setValue, getValues]);

  const handleFormSubmitWrapper = async (data: MenuItemFormData) => {
    if (isUploadingImage) {
      toast({ title: "请稍候", description: "图片正在上传中。" });
      return;
    }
    await onSubmit(data);
  };

  const totalLoading = isLoading || isUploadingImage;

  return (
    <form onSubmit={handleSubmit(handleFormSubmitWrapper)} className="contents">
      <div className="space-y-6 p-6 pt-4 pb-0">
        <div>
          <Label htmlFor="name">名称 / 菜品名称</Label>
          <Input id="name" {...register('name')} placeholder="例如: 经典汉堡" disabled={totalLoading} />
          {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <Label htmlFor="description">描述 / 菜品描述</Label>
          <Textarea id="description" {...register('description')} placeholder="例如: 多汁牛肉饼..." disabled={totalLoading} />
          {errors.description && <p className="text-xs text-destructive mt-1">{errors.description.message}</p>}
        </div>
        <div>
          <Label htmlFor="price">价格 (¥) / 价格 (元)</Label>
          <Input id="price" type="number" step="0.01" {...register('price')} placeholder="例如: 25.50" disabled={totalLoading} />
          {errors.price && <p className="text-xs text-destructive mt-1">{errors.price.message}</p>}
        </div>
        <div>
          <Label htmlFor="imageUpload">图片 / 图片 (上传至 PICUI)</Label>
           <div className="mt-1 text-xs text-destructive/80"><p><strong>安全警告:</strong> PICUI API 令牌在客户端使用。这对于生产环境是不安全的。</p></div>
          <div className="flex items-center space-x-3 mt-2">
            <Input
              id="imageUpload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={totalLoading}
            />
            {(imageFile || (watchedImageUrl && imagePreview)) && (
              <Button type="button" variant="ghost" size="sm" onClick={() => clearImageSelectionLogic()} disabled={totalLoading}>
                <XCircle className="h-4 w-4 mr-1" /> 清除
              </Button>
            )}
          </div>
          {isUploadingImage && uploadProgress !== null && (
            <div className="mt-2 space-y-1">
              <Progress value={uploadProgress} className="w-full h-2" />
              <p className="text-xs text-muted-foreground">上传中: {uploadProgress}%</p>
            </div>
          )}
          {imagePreview && (
            <div className="mt-3 relative group w-40 h-32 border rounded-md overflow-hidden shadow-sm bg-muted/30">
              <Image src={imagePreview} alt="预览" fill sizes="(max-width: 640px) 100vw, 160px" style={{objectFit:"cover"}} onError={() => setImagePreview("https://placehold.co/160x128.png?text=错误")} />
            </div>
          )}
           {!imagePreview && !imageFile && (
             <div className="text-center py-4 text-muted-foreground border border-dashed rounded-md mt-2">
                <ImagePlus className="mx-auto h-8 w-8 mb-1" />
                上传菜单项图片。
            </div>
           )}
           <p className="text-xs text-muted-foreground mt-1">选择一个图片文件进行上传。上传会自动开始。</p>
        </div>
        <div>
          <Label htmlFor="dataAiHint">AI图片提示词 (可选)</Label>
          <Input id="dataAiHint" {...register('dataAiHint')} placeholder="例如: 美味的汉堡" disabled={totalLoading} />
          <p className="text-xs text-muted-foreground mt-1">若无图片，用于AI占位图的关键词，例如 "健康的沙拉"。</p>
          {errors.dataAiHint && <p className="text-xs text-destructive mt-1">{errors.dataAiHint.message}</p>}
        </div>
      </div>
      <div className="flex justify-end space-x-2 p-6 bg-background sticky bottom-0 z-10 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={() => { if (!isUploadingImage && onCancel) onCancel(); }} disabled={totalLoading}>
            取消
          </Button>
        )}
        <Button type="submit" disabled={totalLoading}>
          {totalLoading && !isUploadingImage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isUploadingImage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading ? '保存中...' : (isUploadingImage ? '上传中...' : (initialData?.id ? '保存更改' : '添加商品'))}
        </Button>
      </div>
    </form>
  );
}
