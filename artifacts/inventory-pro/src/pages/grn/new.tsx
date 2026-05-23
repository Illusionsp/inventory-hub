import React from "react";
import { useLocation } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useListSuppliers,
  useListStores,
  useListProducts,
  useCreateGrn,
  useSubmitGrn,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Save, Send } from "lucide-react";

const grnItemSchema = z.object({
  productId: z.coerce.number().min(1, "Product is required"),
  quantity: z.coerce.number().min(0.01, "Quantity must be > 0"),
  unit: z.string().min(1, "Unit is required"),
  unitCost: z.coerce.number().min(0, "Cost must be >= 0"),
  totalCost: z.number().default(0),
});

const grnSchema = z.object({
  supplierId: z.coerce.number().min(1, "Supplier is required"),
  storeId: z.coerce.number().min(1, "Store is required"),
  receivedDate: z.string().min(1, "Date is required"),
  invoiceNumber: z.string().optional(),
  poNumber: z.string().optional(),
  deliveryNoteNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(grnItemSchema).min(1, "At least one item is required"),
});

type FormValues = z.infer<typeof grnSchema>;

export default function CreateGrn() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: suppliers } = useListSuppliers({ limit: 100 } as any);
  const { data: stores } = useListStores();
  const { data: productsData } = useListProducts({ limit: 500 } as any);
  const products = productsData?.data || [];

  const form = useForm<FormValues>({
    resolver: zodResolver(grnSchema),
    defaultValues: {
      receivedDate: new Date().toISOString().split("T")[0],
      items: [{ productId: 0, quantity: 1, unit: "kg", unitCost: 0, totalCost: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const createGrn = useCreateGrn();
  const submitGrn = useSubmitGrn();

  const handleSaveDraft = async (values: FormValues) => {
    try {
      await createGrn.mutateAsync({ data: values });
      toast({ title: "Draft Saved", description: "GRN draft saved successfully." });
      setLocation("/grn");
    } catch (e) {
      toast({ title: "Error", description: "Failed to save draft.", variant: "destructive" });
    }
  };

  const handleSubmitApproval = async (values: FormValues) => {
    try {
      const grn = await createGrn.mutateAsync({ data: values });
      await submitGrn.mutateAsync({ id: grn.id });
      toast({ title: "Submitted", description: "GRN submitted for approval." });
      setLocation("/grn");
    } catch (e) {
      toast({ title: "Error", description: "Failed to submit GRN.", variant: "destructive" });
    }
  };

  const watchItems = form.watch("items");
  const totalAmount = watchItems.reduce((sum, item) => sum + (item.quantity * item.unitCost || 0), 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create GRN</h1>
          <p className="text-muted-foreground mt-1">Receive new stock from a supplier.</p>
        </div>
      </div>

      <Form {...form}>
        <form className="space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
                      <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString() || ""}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers?.data.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="storeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receiving Store</FormLabel>
                      <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString() || ""}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {stores?.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="receivedDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Received Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reference Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="poNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PO Number (Optional)</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="invoiceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier Invoice # (Optional)</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="deliveryNoteNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Note # (Optional)</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <CardTitle>Line Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: 0, quantity: 1, unit: "kg", unitCost: 0, totalCost: 0 })}>
                <Plus className="h-4 w-4 mr-2" /> Add Item
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-4 p-4 border rounded-md bg-muted/20">
                    <div className="flex-1 grid grid-cols-12 gap-4">
                      <div className="col-span-12 md:col-span-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.productId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Product</FormLabel>
                              <Select onValueChange={(val) => {
                                field.onChange(Number(val));
                                const p = products.find(x => x.id === Number(val));
                                if (p) {
                                  form.setValue(`items.${index}.unit`, p.unit);
                                  form.setValue(`items.${index}.unitCost`, p.unitCost || 0);
                                  form.setValue(`items.${index}.totalCost`, (p.unitCost || 0) * form.getValues(`items.${index}.quantity`));
                                }
                              }} value={field.value?.toString() || ""}>
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {products.map((p) => (
                                    <SelectItem key={p.id} value={p.id.toString()}>{p.name} ({p.sku})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Quantity</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" {...field} onChange={(e) => {
                                  field.onChange(e);
                                  const cost = form.getValues(`items.${index}.unitCost`);
                                  form.setValue(`items.${index}.totalCost`, Number(e.target.value) * cost);
                                }}/>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.unit`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Unit</FormLabel>
                              <FormControl><Input {...field} readOnly className="bg-muted" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.unitCost`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Unit Cost</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" {...field} onChange={(e) => {
                                  field.onChange(e);
                                  const qty = form.getValues(`items.${index}.quantity`);
                                  form.setValue(`items.${index}.totalCost`, Number(e.target.value) * qty);
                                }}/>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.totalCost`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Line Total</FormLabel>
                              <FormControl><Input type="number" {...field} readOnly className="bg-muted font-mono" value={field.value.toFixed(2)} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    {fields.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="mt-6 text-destructive hover:bg-destructive/10" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <div className="flex justify-end pt-4 border-t">
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground mr-4">Total Amount:</span>
                    <span className="text-2xl font-bold font-mono">${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl><Textarea placeholder="Any additional notes..." className="min-h-[100px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => form.handleSubmit(handleSaveDraft)()} disabled={createGrn.isPending}>
              <Save className="h-4 w-4 mr-2" /> Save as Draft
            </Button>
            <Button type="button" onClick={() => form.handleSubmit(handleSubmitApproval)()} disabled={createGrn.isPending || submitGrn.isPending}>
              <Send className="h-4 w-4 mr-2" /> Submit for Approval
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
