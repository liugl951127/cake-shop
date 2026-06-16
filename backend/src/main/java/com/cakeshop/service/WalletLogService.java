package com.cakeshop.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.entity.WalletLog;
import com.cakeshop.repository.WalletLogRepository;
import org.springframework.stereotype.Service;

@Service
public class WalletLogService extends ServiceImpl<WalletLogRepository, WalletLog> {
}
