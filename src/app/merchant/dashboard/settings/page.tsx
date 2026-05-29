
// src/app/merchant/dashboard/settings/page.tsx
'use client';

import { useState, useEffect, useCallback, useId } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import type { Restaurant, RestaurantPaymentMethod } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, ArrowLeft, ImagePlus, XCircle, AlertTriangle, PlusCircle, Trash2, Edit3, Store } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogTrigger, DialogContent, DialogHeader as ShadDialogHeader, DialogTitle as ShadDialogTitle, DialogDescription as ShadDialogDescription, DialogFooter as ShadDialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const PICUI_API_URL = 'https://picui.cn/api/v1/upload';
const PICUI_API_TOKEN = process.env.NEXT_PUBLIC_PICUI_API_TOKEN || ''; 

interface PaymentMethodFormData {
  id: string;
  type: 'alipay' | 'wechat' | 'custom';
  name: string;
  qrCodeUrl: string;
  qrFile?: File | null;
}

export default function MerchantSettingsPage() {
  const { currentUser, loadingAuth } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantNameInput, setRestaurantNameInput] = useState('');
  const [restaurantCuisineInput, setRestaurantCuisineInput] = useState('');
  const [restaurantDescriptionInput, setRestaurantDescriptionInput] = useState('');

  const [restaurantImageFile, setRestaurantImageFile] = useState<File | null>(null);
  const [restaurantImagePreview, setRestaurantImagePreview] = useState<string | null>(null);
  const [isUploadingRestaurantImage, setIsUploadingRestaurantImage] = useState(false);
  const [restaurantImageUploadProgress, setRestaurantImageUploadProgress] = useState<number | null>(null);
  const [newRestaurantImageUrl, setNewRestaurantImageUrl] = useState<string | null>(null); 

  const [activePaymentMethods, setActivePaymentMethods] = useState<RestaurantPaymentMethod[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [isFormDialogValid, setIsFormDialogValid] = useState(false);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethodFormData | null>(null);
  const [currentQrFile, setCurrentQrFile] = useState<File | null>(null);
  const [currentQrPreview, setCurrentQrPreview] = useState<string | null>(null);
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  const formIdPrefix = useId();


  const fetchRestaurantData = useCallback(async () => {
    if (!currentUser?.uid) return;
    setIsLoadingPage(true);
    setPageError(null);
    try {
      const restaurantRef = doc(db, "restaurants", currentUser.uid);
      const docSnap = await getDoc(restaurantRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Restaurant;
        setRestaurant(data);
        setRestaurantNameInput(data.name);
        setRestaurantCuisineInput(data.cuisine);
        setRestaurantDescriptionInput(data.description || '');
        setRestaurantImagePreview(data.imageUrl); 
        setNewRestaurantImageUrl(null); 
        setActivePaymentMethods(data.activePaymentMethods || []);
      } else {
        setPageError("未找到餐馆数据。请确保您的餐馆在注册时已正确设置或联系支持。");
        toast({ title: "错误", description: "无法加载餐馆数据。这可能发生在您的餐馆注册未完成的情况下。", variant: "destructive" });
      }
    } catch (err) {
      console.error("获取餐馆数据出错:", err);
      setPageError("加载餐馆设置失败。请重试。");
      toast({ title: "加载错误", description: "无法加载设置。", variant: "destructive" });
    } finally {
      setIsLoadingPage(false);
    }
  }, [currentUser?.uid, toast]);

  useEffect(() => {
    if (loadingAuth) return;
    if (!currentUser) {
      router.push('/merchant/login');
    } else {
      fetchRestaurantData();
    }
  }, [currentUser, loadingAuth, router, fetchRestaurantData]);

  const openAddFormDialog = () => {
    setEditingMethod({
      id: `new_${Date.now()}`, 
      type: 'alipay', 
      name: '支付宝', 
      qrCodeUrl: '',
      qrFile: null,
    });
    setCurrentQrFile(null);
    setCurrentQrPreview(null);
    setIsFormDialogOpen(true);
  };

  const openEditFormDialog = (method: RestaurantPaymentMethod) => {
    setEditingMethod({
      id: method.id,
      type: method.type,
      name: method.name,
      qrCodeUrl: method.qrCodeUrl,
      qrFile: null,
    });
    setCurrentQrFile(null);
    setCurrentQrPreview(method.qrCodeUrl);
    setIsFormDialogOpen(true);
  };
  
  const validatePaymentMethodForm = () => {
    if (!editingMethod) return false;
    if (!editingMethod.type) return false;
    if (!editingMethod.name.trim()) return false;
    if (!editingMethod.qrCodeUrl && !currentQrFile) return false; 
    return true;
  };

  useEffect(() => {
    setIsFormDialogValid(validatePaymentMethodForm());
  }, [editingMethod, currentQrFile, currentQrPreview]);


  const handleQrFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && editingMethod) {
      setCurrentQrFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentQrPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setEditingMethod(prev => prev ? {...prev, qrCodeUrl: ''} : null); 
    }
  };
  
  const clearQrImageSelection = () => {
    setCurrentQrFile(null);
    if (editingMethod) {
      setCurrentQrPreview(editingMethod.qrCodeUrl || null);
    } else {
      setCurrentQrPreview(null);
    }
    const fileInput = document.getElementById(`${formIdPrefix}-qrImageUpload`) as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const uploadImageToPicUI = async (
    fileToUpload: File,
    progressSetter: (value: number | null) => void,
    uploadingSetter: (value: boolean) => void
  ): Promise<string | null> => {
    if (!PICUI_API_TOKEN) {
      toast({ title: '图片上传未配置', description: '请设置 NEXT_PUBLIC_PICUI_API_TOKEN。', variant: 'destructive' });
      return null;
    }
    uploadingSetter(true);
    progressSetter(0);
    const formData = new FormData();
    formData.append('file', fileToUpload);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', PICUI_API_URL, true);
      xhr.setRequestHeader('Authorization', `Bearer ${PICUI_API_TOKEN}`);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) progressSetter(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        uploadingSetter(false);
        progressSetter(100);
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const response = JSON.parse(xhr.responseText);
            const uploadedUrl = response?.data?.links?.url || response?.data?.url;
            if (uploadedUrl) resolve(uploadedUrl);
            else reject('PICUI: 未在响应中找到图片URL。');
          } catch (e) { reject('PICUI: 无效的JSON响应。'); }
        } else reject(`PICUI: 状态 ${xhr.status}。响应: ${xhr.responseText}`);
      };
      xhr.onerror = () => {uploadingSetter(false); reject('PICUI: 网络错误。');};
      xhr.send(formData);
    });
  };


  const handleSavePaymentMethod = async () => {
    if (!editingMethod || !validatePaymentMethodForm()) {
      toast({ title: "错误", description: "请填写所有必填项并上传或确认二维码。", variant: "destructive" });
      return;
    }

    let finalQrCodeUrl = editingMethod.qrCodeUrl;

    if (currentQrFile) {
      try {
        const uploadedUrl = await uploadImageToPicUI(currentQrFile, setUploadProgress, setIsUploadingQr);
        if (uploadedUrl) {
          finalQrCodeUrl = uploadedUrl;
          toast({ title: "二维码已上传", description: "新的二维码图片已上传。" });
        } else throw new Error("二维码上传未返回URL。");
      } catch (uploadError: any) {
        toast({ title: "二维码上传失败", description: uploadError.toString(), variant: "destructive" });
        setIsUploadingQr(false); 
        return; 
      }
    }
    
    if (!finalQrCodeUrl) {
        toast({ title: "缺少二维码", description: "需要提供二维码图片。", variant: "destructive" });
        return;
    }

    const newMethodEntry: RestaurantPaymentMethod = {
      id: editingMethod.id.startsWith('new_') ? `pm_${Date.now()}` : editingMethod.id,
      type: editingMethod.type,
      name: editingMethod.name.trim(),
      qrCodeUrl: finalQrCodeUrl,
    };

    setActivePaymentMethods(prev => {
      const existingIndex = prev.findIndex(m => m.id === newMethodEntry.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = newMethodEntry;
        return updated;
      }
      return [...prev, newMethodEntry];
    });

    setIsFormDialogOpen(false);
    setEditingMethod(null);
    setCurrentQrFile(null);
    setCurrentQrPreview(null);
    toast({ title: "支付方式已本地保存", description: `${newMethodEntry.name} 详情已更新。点击“保存所有设置”以持久化。` });
  };

  const handleDeletePaymentMethod = (methodId: string) => {
    if (!window.confirm("您确定要删除此支付方式吗？此更改将在您点击“保存所有设置”时生效。")) return;
    setActivePaymentMethods(prev => prev.filter(m => m.id !== methodId));
    toast({ title: "支付方式已本地移除", description: "已移除。点击“保存所有设置”以持久化。" });
  };


  const handleRestaurantImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setRestaurantImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setRestaurantImagePreview(reader.result as string); 
      };
      reader.readAsDataURL(file);

      try {
        const uploadedUrl = await uploadImageToPicUI(file, setRestaurantImageUploadProgress, setIsUploadingRestaurantImage);
        if (uploadedUrl) {
          setNewRestaurantImageUrl(uploadedUrl); 
          setRestaurantImagePreview(uploadedUrl); 
          toast({ title: "餐馆图片已上传", description: "新图片已准备就绪。点击“保存所有设置”以应用。" });
        } else {
          throw new Error("图片上传未返回URL。");
        }
      } catch (uploadError: any) {
        toast({ title: "餐馆图片上传失败", description: uploadError.toString(), variant: "destructive" });
        setRestaurantImagePreview(restaurant?.imageUrl || null); 
        setRestaurantImageFile(null);
        setIsUploadingRestaurantImage(false);
      }
    }
  };

  const clearRestaurantImageSelection = () => {
    setRestaurantImageFile(null);
    setRestaurantImagePreview(restaurant?.imageUrl || null); 
    setNewRestaurantImageUrl(null); 
    setRestaurantImageUploadProgress(null);
    setIsUploadingRestaurantImage(false);
    const fileInput = document.getElementById(`${formIdPrefix}-restaurantImageUpload`) as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleSaveSettingsToFirestore = async () => {
    if (!currentUser?.uid || !restaurant) {
      toast({title: "错误", description: "用户或餐馆数据缺失，无法保存。", variant: "destructive"});
      return;
    }
    if (!restaurantNameInput.trim()){
      toast({title: "验证错误", description: "餐馆名称不能为空。", variant: "destructive"});
      return;
    }
    if (!restaurantCuisineInput.trim()){
      toast({title: "验证错误", description: "菜系类型不能为空。", variant: "destructive"});
      return;
    }

    setIsSaving(true);
    try {
      const restaurantRef = doc(db, "restaurants", currentUser.uid);
      const updatedRestaurantData: Partial<Restaurant> = {
        name: restaurantNameInput.trim(),
        cuisine: restaurantCuisineInput.trim(),
        description: restaurantDescriptionInput.trim() || undefined, 
        activePaymentMethods: activePaymentMethods,
      };

      if (newRestaurantImageUrl) { 
        updatedRestaurantData.imageUrl = newRestaurantImageUrl;
      }

      await updateDoc(restaurantRef, updatedRestaurantData);
      
      setRestaurant(prev => {
        if (!prev) return null;
        const finalData = { ...prev, ...updatedRestaurantData };
        if (newRestaurantImageUrl) finalData.imageUrl = newRestaurantImageUrl; 
        return finalData;
      });
      setNewRestaurantImageUrl(null); 

      toast({ title: "设置已保存!", description: "餐馆信息和支付方式已成功更新。" });
    } catch (err) {
      console.error("保存设置出错:", err);
      toast({ title: "保存失败", description: "无法将设置保存到数据库。请重试。", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  const defaultNameForType = (type: 'alipay' | 'wechat' | 'custom') => {
    if (type === 'alipay') return '支付宝';
    if (type === 'wechat') return '微信支付';
    return '';
  }

  if (loadingAuth || isLoadingPage) {
    return ( <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-16 w-16 text-primary animate-spin mb-4" /><p className="text-muted-foreground">{loadingAuth ? "正在验证身份..." : "正在加载设置..."}</p></div>);
  }
  if (pageError && !isLoadingPage) {
    return (<div className="flex flex-col items-center justify-center py-10 text-center"><AlertTriangle className="h-12 w-12 text-destructive mb-4" /><h2 className="text-xl font-semibold text-destructive mb-2">加载设置出错</h2><p className="text-muted-foreground mb-6 max-w-md">{pageError}</p><Button onClick={() => router.push('/merchant/dashboard')}><ArrowLeft className="mr-2 h-4 w-4" />仪表盘</Button><Button onClick={fetchRestaurantData} variant="outline" className="ml-2">重试</Button></div>);
  }
  if (!restaurant && !loadingAuth && !isLoadingPage && !pageError) {
    return (<div className="flex flex-col items-center justify-center py-10 text-center"><AlertTriangle className="h-12 w-12 text-destructive mb-4" /><h2 className="text-xl font-semibold text-destructive mb-2">未找到餐馆数据</h2><p className="text-muted-foreground mb-6 max-w-md">您的账户 ({currentUser?.email}) 似乎缺少关键的餐馆数据。如果注册过程被中断或数据存在一致性问题，可能会发生这种情况。请尝试重新加载或联系支持人员。</p><Button onClick={() => router.push('/merchant/dashboard')}><ArrowLeft className="mr-2 h-4 w-4" />仪表盘</Button> <Button onClick={fetchRestaurantData} variant="outline" className="ml-2">重试加载</Button> </div>);
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">餐馆设置</h1>
        <Button variant="outline" onClick={() => router.push('/merchant/dashboard')} disabled={isSaving || isUploadingRestaurantImage || isUploadingQr}><ArrowLeft className="mr-2 h-4 w-4" />仪表盘</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Store className="mr-2 h-5 w-5 text-primary" /> 餐馆信息</CardTitle>
          <CardDescription>编辑您的餐馆名称、菜系类型、描述和主图。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6"> 
          <div>
            <Label htmlFor={`${formIdPrefix}-restaurantName`}>餐馆名称</Label>
            <Input
              id={`${formIdPrefix}-restaurantName`}
              value={restaurantNameInput}
              onChange={(e) => setRestaurantNameInput(e.target.value)}
              placeholder="例如: 温馨角落咖啡馆"
              disabled={isSaving || isUploadingRestaurantImage}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor={`${formIdPrefix}-restaurantCuisine`}>菜系类型</Label>
            <Input
              id={`${formIdPrefix}-restaurantCuisine`}
              value={restaurantCuisineInput}
              onChange={(e) => setRestaurantCuisineInput(e.target.value)}
              placeholder="例如: 意大利菜, 咖啡与糕点, 健康沙拉"
              disabled={isSaving || isUploadingRestaurantImage}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor={`${formIdPrefix}-restaurantDescription`}>简短描述 (可选)</Label>
            <Textarea 
              id={`${formIdPrefix}-restaurantDescription`} 
              value={restaurantDescriptionInput} 
              onChange={(e) => setRestaurantDescriptionInput(e.target.value)} 
              placeholder="餐馆的简要介绍。" 
              disabled={isSaving || isUploadingRestaurantImage}
              className="mt-1"
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor={`${formIdPrefix}-restaurantImageUpload`}>餐馆图片 / 主图</Label>
            <div className="flex items-center space-x-3">
                <Input 
                  id={`${formIdPrefix}-restaurantImageUpload`} 
                  type="file" 
                  accept="image/*" 
                  onChange={handleRestaurantImageFileChange} 
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed" 
                  disabled={isSaving || isUploadingRestaurantImage}
                />
                {(restaurantImageFile || restaurantImagePreview) && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearRestaurantImageSelection} disabled={isSaving || isUploadingRestaurantImage}>
                    <XCircle className="h-4 w-4 mr-1" /> 清除
                  </Button>
                )}
            </div>
            {isUploadingRestaurantImage && restaurantImageUploadProgress !== null && (
              <div className="mt-2 space-y-1">
                <Progress value={restaurantImageUploadProgress} className="w-full h-2" />
                <p className="text-xs text-muted-foreground">上传中: {restaurantImageUploadProgress}%</p>
              </div>
            )}
             {restaurantImagePreview && (
              <div className="mt-3 relative w-48 h-32 border rounded-md overflow-hidden shadow-sm bg-muted/30">
                <Image 
                  src={restaurantImagePreview} 
                  alt="餐馆预览" 
                  fill 
                  sizes="(max-width: 768px) 100vw, 192px"
                  style={{ objectFit: 'cover' }} 
                  onError={() => setRestaurantImagePreview("https://placehold.co/600x400.png?text=Error")}
                  data-ai-hint={restaurant?.dataAiHint || "restaurant"}
                />
              </div>
            )}
            {!restaurantImagePreview && !restaurantImageFile && (
              <div className="text-center py-4 text-muted-foreground border border-dashed rounded-md mt-2">
                <ImagePlus className="mx-auto h-8 w-8 mb-1" />
                上传您的餐馆主图。
              </div>
            )}
             <p className="text-xs text-muted-foreground mt-1">
                选择一个图片文件上传至 PICUI。上传将自动开始。更改将在点击“保存所有设置”后应用。
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
                <CardTitle>支付方式</CardTitle>
                <CardDescription>管理支付宝、微信支付或自定义方式的收款二维码。</CardDescription>
            </div>
            <Button onClick={openAddFormDialog} size="sm" disabled={isSaving || isFormDialogOpen || isUploadingRestaurantImage}><PlusCircle className="mr-2 h-4 w-4" /> 添加方式</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-xs text-destructive/80 mb-2">
            <p><strong>安全警告:</strong> PICUI API 令牌在客户端用于上传二维码。这对于生产环境是不安全的。建议使用后端解决方案来获取临时令牌。</p>
          </div>
          {activePaymentMethods.length === 0 && (
            <p className="text-muted-foreground text-center py-4">尚未添加任何支付方式。</p>
          )}
          {activePaymentMethods.map((method) => (
            <Card key={method.id} className="p-4 flex flex-col sm:flex-row justify-between items-start bg-muted/30 gap-3">
              <div className="flex items-start space-x-4">
                <div className="relative w-24 h-24 border rounded-md overflow-hidden shadow-sm bg-white shrink-0">
                  <Image src={method.qrCodeUrl} alt={`${method.name} 二维码`} fill sizes="96px" style={{ objectFit: 'contain' }} data-ai-hint="payment QR code"/>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{method.name}</h3>
                  <p className="text-sm capitalize text-muted-foreground">类型: {method.type}</p>
                </div>
              </div>
              <div className="flex sm:flex-col space-x-2 sm:space-x-0 sm:space-y-2 self-start sm:self-center mt-2 sm:mt-0">
                <Button variant="outline" size="sm" onClick={() => openEditFormDialog(method)} disabled={isSaving || isFormDialogOpen || isUploadingRestaurantImage || isUploadingQr} className="w-full sm:w-auto"><Edit3 className="mr-1 h-4 w-4" /> 编辑</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDeletePaymentMethod(method.id)} disabled={isSaving || isFormDialogOpen || isUploadingRestaurantImage || isUploadingQr} className="w-full sm:w-auto"><Trash2 className="mr-1 h-4 w-4" /> 删除</Button>
              </div>
            </Card>
          ))}
        </CardContent>
      </Card>
      
      <div className="mt-8 pt-6 border-t flex justify-end">
          <Button onClick={handleSaveSettingsToFirestore} disabled={isSaving || isLoadingPage || pageError !== null || isUploadingRestaurantImage || isUploadingQr} size="lg">
            {(isSaving || isUploadingRestaurantImage) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? '保存中...' : (isUploadingRestaurantImage ? '图片上传中...' : '保存所有设置')}
          </Button>
      </div>
      
      <Dialog open={isFormDialogOpen} onOpenChange={(open) => {
          if (isUploadingQr || isSaving) return; 
          setIsFormDialogOpen(open);
          if (!open) { setEditingMethod(null); setCurrentQrFile(null); setCurrentQrPreview(null); }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <ShadDialogHeader>
            <ShadDialogTitle>{editingMethod?.id.startsWith('new_') ? '添加新' : '编辑'}支付方式</ShadDialogTitle>
            <ShadDialogDescription>
              提供此支付方式的详细信息。上传的二维码将在您此处保存方式时处理，然后通过“保存所有设置”确认。
            </ShadDialogDescription>
          </ShadDialogHeader>
          {editingMethod && (
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor={`${formIdPrefix}-type`}>类型</Label>
                <Select
                  value={editingMethod.type}
                  onValueChange={(value: 'alipay' | 'wechat' | 'custom') => {
                    setEditingMethod(prev => prev ? { ...prev, type: value, name: prev.type === 'custom' && value !== 'custom' ? defaultNameForType(value) : (value === 'custom' ? '' : defaultNameForType(value)) } : null);
                  }}
                  disabled={!editingMethod.id.startsWith('new_') || isUploadingQr || isSaving} 
                >
                  <SelectTrigger id={`${formIdPrefix}-type`} className="w-full mt-1">
                    <SelectValue placeholder="选择支付类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alipay">支付宝</SelectItem>
                    <SelectItem value="wechat">微信支付</SelectItem>
                    <SelectItem value="custom">自定义</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`${formIdPrefix}-name`}>显示名称</Label>
                <Input 
                  id={`${formIdPrefix}-name`}
                  value={editingMethod.name}
                  onChange={(e) => setEditingMethod(prev => prev ? {...prev, name: e.target.value} : null)}
                  placeholder={editingMethod.type === 'custom' ? "例如: 银行转账二维码" : defaultNameForType(editingMethod.type)}
                  disabled={(editingMethod.type !== 'custom' && !editingMethod.id.startsWith('new_')) || isUploadingQr || isSaving}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor={`${formIdPrefix}-qrImageUpload`}>二维码图片</Label>
                <div className="flex items-center space-x-3 mt-1">
                    <Input id={`${formIdPrefix}-qrImageUpload`} type="file" accept="image/*" onChange={handleQrFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 disabled:opacity-50" disabled={isUploadingQr || isSaving} />
                    {(currentQrFile || currentQrPreview) && (<Button type="button" variant="ghost" size="sm" onClick={clearQrImageSelection} disabled={isUploadingQr || isSaving}><XCircle className="h-4 w-4 mr-1" /> 清除</Button>)}
                </div>
                {isUploadingQr && uploadProgress !== null && (<div className="mt-2 space-y-1"><Progress value={uploadProgress} className="w-full h-2" /><p className="text-xs text-muted-foreground">上传中: {uploadProgress}%</p></div>)}
              </div>
              {currentQrPreview && (
                <div>
                  <Label>预览:</Label>
                  <div className="mt-2 relative w-32 h-32 border rounded-md overflow-hidden shadow-sm bg-muted/30 mx-auto">
                    <Image src={currentQrPreview} alt="二维码预览" fill sizes="128px" style={{ objectFit: 'contain' }} onError={() => setCurrentQrPreview("https://placehold.co/300x300.png?text=错误")}/>
                  </div>
                </div>
              )}
               {!currentQrPreview && !currentQrFile && (
                <div className="text-center py-3 text-muted-foreground border border-dashed rounded-md">
                  <ImagePlus className="mx-auto h-8 w-8 mb-1" />
                  上传二维码图片。
                </div>
              )}
            </div>
          )}
          <ShadDialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" disabled={isUploadingQr || isSaving}>取消</Button></DialogClose>
            <Button type="button" onClick={handleSavePaymentMethod} disabled={isUploadingQr || !isFormDialogValid || isSaving}>
              {isUploadingQr ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isUploadingQr ? '上传中...' : (editingMethod?.id.startsWith('new_') ? '本地添加方式' : '本地更新方式')}
            </Button>
          </ShadDialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
